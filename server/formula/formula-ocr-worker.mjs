import { inflateSync } from 'node:zlib';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const IMAGE_SIZE = 384;
const MAX_NEW_TOKENS = 1024;
const BOS_TOKEN_ID = 1;
const EOS_TOKEN_ID = 2;
const PAD_TOKEN_ID = 0;
const MAX_IMAGE_PIXELS = 16_000_000;
const MAX_DECODED_PNG_BYTES = 128 * 1024 * 1024;

function workerError(message, code = 'FORMULA_OCR_FAILED') {
  const error = Error(message);
  error.code = code;
  return error;
}

function readUint32(bytes, offset) {
  return bytes.readUInt32BE(offset);
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function applyPngFilter(type, row, previous, bytesPerPixel) {
  for (let index = 0; index < row.length; index++) {
    const left = index >= bytesPerPixel ? row[index - bytesPerPixel] : 0;
    const up = previous ? previous[index] : 0;
    const upperLeft = previous && index >= bytesPerPixel ? previous[index - bytesPerPixel] : 0;
    if (type === 1) row[index] = (row[index] + left) & 255;
    else if (type === 2) row[index] = (row[index] + up) & 255;
    else if (type === 3) row[index] = (row[index] + Math.floor((left + up) / 2)) & 255;
    else if (type === 4) row[index] = (row[index] + paeth(left, up, upperLeft)) & 255;
    else if (type !== 0)
      throw workerError(`Unsupported PNG filter type ${type}.`, 'UNSUPPORTED_IMAGE');
  }
}

function readPng(buffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buffer.length < signature.length || !signature.equals(buffer.subarray(0, signature.length)))
    throw workerError('Formula OCR accepts PNG image buffers only.', 'UNSUPPORTED_IMAGE');
  let offset = signature.length;
  let width;
  let height;
  let bitDepth;
  let colorType;
  let interlace;
  let palette = null;
  let transparency = null;
  const compressed = [];
  while (offset + 12 <= buffer.length) {
    const length = readUint32(buffer, offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const start = offset + 8;
    const end = start + length;
    if (end + 4 > buffer.length) throw workerError('PNG chunk is truncated.', 'UNSUPPORTED_IMAGE');
    const data = buffer.subarray(start, end);
    offset = end + 4;
    if (type === 'IHDR') {
      if (length !== 13) throw workerError('PNG header is invalid.', 'UNSUPPORTED_IMAGE');
      width = readUint32(data, 0);
      height = readUint32(data, 4);
      bitDepth = data[8];
      colorType = data[9];
      if (data[10] !== 0 || data[11] !== 0)
        throw workerError('Unsupported PNG compression.', 'UNSUPPORTED_IMAGE');
      interlace = data[12];
    } else if (type === 'PLTE') palette = data;
    else if (type === 'tRNS') transparency = data;
    else if (type === 'IDAT') compressed.push(data);
    else if (type === 'IEND') break;
  }
  if (!width || !height || width * height > MAX_IMAGE_PIXELS)
    throw workerError('PNG dimensions are invalid or too large.', 'UNSUPPORTED_IMAGE');
  if (interlace !== 0)
    throw workerError('Interlaced PNG images are unsupported.', 'UNSUPPORTED_IMAGE');
  const channelsByColorType = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
  const channels = channelsByColorType[colorType];
  if (!channels || ![1, 2, 4, 8, 16].includes(bitDepth))
    throw workerError('PNG color format is unsupported.', 'UNSUPPORTED_IMAGE');
  if (colorType === 3 && (!palette || palette.length % 3 !== 0))
    throw workerError('Indexed PNG has no valid palette.', 'UNSUPPORTED_IMAGE');
  const bitsPerPixel = channels * bitDepth;
  const rowBytes = Math.ceil((width * bitsPerPixel) / 8);
  const filterBytesPerPixel = Math.max(1, Math.ceil(bitsPerPixel / 8));
  const expectedBytes = height * (rowBytes + 1);
  if (expectedBytes > MAX_DECODED_PNG_BYTES)
    throw workerError('PNG pixel data is too large.', 'UNSUPPORTED_IMAGE');
  const inflated = inflateSync(Buffer.concat(compressed), {
    maxOutputLength: expectedBytes,
  });
  if (inflated.length < expectedBytes)
    throw workerError('PNG pixel data is truncated.', 'UNSUPPORTED_IMAGE');
  const rgb = new Uint8Array(width * height * 3);
  const alpha =
    colorType === 4 || colorType === 6 || transparency ? new Uint8Array(width * height) : null;
  let previous = null;
  let sourceOffset = 0;
  for (let y = 0; y < height; y++) {
    const filter = inflated[sourceOffset++];
    const row = Uint8Array.from(inflated.subarray(sourceOffset, sourceOffset + rowBytes));
    sourceOffset += rowBytes;
    applyPngFilter(filter, row, previous, filterBytesPerPixel);
    const writePixel = (x, red, green, blue, pixelAlpha = 255) => {
      const pixel = y * width + x;
      rgb[pixel * 3] = red;
      rgb[pixel * 3 + 1] = green;
      rgb[pixel * 3 + 2] = blue;
      if (alpha) alpha[pixel] = pixelAlpha;
    };
    if (bitDepth === 8) {
      for (let x = 0; x < width; x++) {
        const source = x * channels;
        if (colorType === 0) {
          const value = row[source];
          const transparent =
            transparency && transparency.length >= 2 && value === transparency.readUInt16BE(0);
          writePixel(x, value, value, value, transparent ? 0 : 255);
        } else if (colorType === 2) {
          const red = row[source];
          const green = row[source + 1];
          const blue = row[source + 2];
          const transparent =
            transparency &&
            transparency.length >= 6 &&
            red === transparency.readUInt16BE(0) &&
            green === transparency.readUInt16BE(2) &&
            blue === transparency.readUInt16BE(4);
          writePixel(x, red, green, blue, transparent ? 0 : 255);
        } else if (colorType === 3) {
          const paletteIndex = row[x];
          const paletteOffset = paletteIndex * 3;
          if (paletteOffset + 2 >= palette.length)
            throw workerError('PNG palette index is invalid.', 'UNSUPPORTED_IMAGE');
          writePixel(
            x,
            palette[paletteOffset],
            palette[paletteOffset + 1],
            palette[paletteOffset + 2],
            transparency?.[paletteIndex] ?? 255,
          );
        } else if (colorType === 4) {
          const value = row[source];
          writePixel(x, value, value, value, row[source + 1]);
        } else {
          writePixel(x, row[source], row[source + 1], row[source + 2], row[source + 3]);
        }
      }
    } else if (bitDepth === 16) {
      for (let x = 0; x < width; x++) {
        const source = x * channels * 2;
        if (colorType === 0) {
          const value = row[source];
          writePixel(x, value, value, value, 255);
        } else if (colorType === 2) writePixel(x, row[source], row[source + 2], row[source + 4]);
        else if (colorType === 4) {
          const value = row[source];
          writePixel(x, value, value, value, row[source + 2]);
        } else if (colorType === 6)
          writePixel(x, row[source], row[source + 2], row[source + 4], row[source + 6]);
        else throw workerError('Indexed 16-bit PNG is unsupported.', 'UNSUPPORTED_IMAGE');
      }
    } else {
      if (colorType !== 0 && colorType !== 3)
        throw workerError('Packed PNG color format is unsupported.', 'UNSUPPORTED_IMAGE');
      const maxValue = (1 << bitDepth) - 1;
      for (let x = 0; x < width; x++) {
        const bit = x * bitDepth;
        const value = (row[bit >> 3] >> (8 - bitDepth - (bit & 7))) & maxValue;
        if (colorType === 0) {
          const scaled = Math.round((value * 255) / maxValue);
          writePixel(x, scaled, scaled, scaled);
        } else {
          const paletteOffset = value * 3;
          if (paletteOffset + 2 >= palette.length)
            throw workerError('PNG palette index is invalid.', 'UNSUPPORTED_IMAGE');
          writePixel(
            x,
            palette[paletteOffset],
            palette[paletteOffset + 1],
            palette[paletteOffset + 2],
            transparency?.[value] ?? 255,
          );
        }
      }
    }
    previous = row;
  }
  return { width, height, rgb, alpha };
}

function compositeTransparentImage(image) {
  if (!image.alpha) return image.rgb;
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;
  for (let index = 0; index < image.alpha.length; index++) {
    if (image.alpha[index] === 0) continue;
    red += image.rgb[index * 3];
    green += image.rgb[index * 3 + 1];
    blue += image.rgb[index * 3 + 2];
    count++;
  }
  if (!count) {
    count = image.alpha.length;
    if (!count) return image.rgb;
    for (let index = 0; index < image.alpha.length; index++) {
      red += image.rgb[index * 3];
      green += image.rgb[index * 3 + 1];
      blue += image.rgb[index * 3 + 2];
    }
  }
  const background = [
    255 - Math.round(red / count),
    255 - Math.round(green / count),
    255 - Math.round(blue / count),
  ];
  const output = new Uint8Array(image.rgb.length);
  for (let index = 0; index < image.alpha.length; index++) {
    const opacity = image.alpha[index] / 255;
    output[index * 3] = Math.round(image.rgb[index * 3] * opacity + background[0] * (1 - opacity));
    output[index * 3 + 1] = Math.round(
      image.rgb[index * 3 + 1] * opacity + background[1] * (1 - opacity),
    );
    output[index * 3 + 2] = Math.round(
      image.rgb[index * 3 + 2] * opacity + background[2] * (1 - opacity),
    );
  }
  return output;
}

function cubicWeight(distance) {
  const value = Math.abs(distance);
  if (value <= 1) return 1.5 * value * value * value - 2.5 * value * value + 1;
  if (value < 2) return -0.5 * value * value * value + 2.5 * value * value - 4 * value + 2;
  return 0;
}

function resizedPixel(rgb, width, height, x, y, channel) {
  const sourceX = ((x + 0.5) * width) / IMAGE_SIZE - 0.5;
  const sourceY = ((y + 0.5) * height) / IMAGE_SIZE - 0.5;
  const xBase = Math.floor(sourceX);
  const yBase = Math.floor(sourceY);
  let result = 0;
  let weightTotal = 0;
  for (let yy = yBase - 1; yy <= yBase + 2; yy++) {
    const clampedY = Math.max(0, Math.min(height - 1, yy));
    const yWeight = cubicWeight(sourceY - yy);
    for (let xx = xBase - 1; xx <= xBase + 2; xx++) {
      const clampedX = Math.max(0, Math.min(width - 1, xx));
      const weight = yWeight * cubicWeight(sourceX - xx);
      result += rgb[(clampedY * width + clampedX) * 3 + channel] * weight;
      weightTotal += weight;
    }
  }
  return Math.max(0, Math.min(255, result / (weightTotal || 1)));
}

function imageToTensor(buffer) {
  const decoded = readPng(buffer);
  const rgb = compositeTransparentImage(decoded);
  const tensor = new Float32Array(3 * IMAGE_SIZE * IMAGE_SIZE);
  const plane = IMAGE_SIZE * IMAGE_SIZE;
  for (let channel = 0; channel < 3; channel++) {
    for (let y = 0; y < IMAGE_SIZE; y++) {
      for (let x = 0; x < IMAGE_SIZE; x++) {
        const value = resizedPixel(rgb, decoded.width, decoded.height, x, y, channel);
        tensor[channel * plane + y * IMAGE_SIZE + x] = (value / 255 - 0.5) / 0.5;
      }
    }
  }
  return tensor;
}

function byteDecoder() {
  const bytes = [];
  for (let value = 33; value <= 126; value++) bytes.push(value);
  for (let value = 161; value <= 172; value++) bytes.push(value);
  for (let value = 174; value <= 255; value++) bytes.push(value);
  const characters = [...bytes];
  let extra = 0;
  for (let value = 0; value < 256; value++) {
    if (bytes.includes(value)) continue;
    bytes.push(value);
    characters.push(256 + extra++);
  }
  const map = new Map();
  for (let index = 0; index < bytes.length; index++)
    map.set(String.fromCodePoint(characters[index]), bytes[index]);
  return map;
}

function decodeTokens(tokenIds, tokenizer) {
  const idToToken = [];
  for (const [token, id] of Object.entries(tokenizer.model.vocab)) idToToken[id] = token;
  const decoder = byteDecoder();
  const bytes = [];
  for (const tokenId of tokenIds) {
    if (
      tokenId === PAD_TOKEN_ID ||
      tokenId === BOS_TOKEN_ID ||
      tokenId === EOS_TOKEN_ID ||
      tokenId === 3 ||
      tokenId === 4
    )
      continue;
    const token = idToToken[tokenId];
    if (typeof token !== 'string') continue;
    for (const character of token) {
      const byte = decoder.get(character);
      if (byte === undefined) bytes.push(...Buffer.from(character));
      else bytes.push(byte);
    }
  }
  return Buffer.from(bytes).toString('utf8');
}

function postProcess(text) {
  let output = text.trim();
  output = output.replace(/^\^\s*{\s*(.*?)\s*}/, '$1').replace(/^_\s*{\s*(.*?)\s*}/, '$1');
  for (const pattern of [
    /\\hat\s*{\s*}/g,
    /\^\s*{\s*}/g,
    /_\s*{\s*}/g,
    /\\text\s*{\s*}/g,
    /\\tilde\s*{\s*}/g,
    /\\bar\s*{\s*}/g,
    /\\vec\s*{\s*}/g,
    /\\dot\s*{\s*}/g,
    /\\ddot\s*{\s*}/g,
    /\\widehat\s*{\s*}/g,
    /\\widetilde\s*{\s*}/g,
  ])
    output = output.replace(pattern, '');
  output = output
    .replace(/\\\./g, '\\ .')
    .replace(/\\=/g, '\\ =')
    .replace(/\\-/g, '\\ -')
    .replace(/\\~/g, '\\ ~');
  output = output.replace(
    /\\ +|\\quad\s*|\\qquad\s*|\\,\s*|\\:\s*|\\;\s*|\\enspace\s*|\\thinspace\s*|\\!\s*$/g,
    '',
  );
  output = output.replace(/\\([a-zA-Z]+)\s+(?![a-zA-Z])/g, '\\$1');
  output = output.replace(/(\{)\s+/g, '$1').replace(/\s+(\})/g, '$1');
  output = output.replace(/(?<=[^\\])\s*([+\-=])\s*/g, '$1').replace(/\s*(\^|_)\s*/g, '$1');
  return output.trim();
}

function lastOutput(outputs, session) {
  const preferred = session.outputNames.find((name) => name === 'logits' || /logits/i.test(name));
  const value = outputs[preferred || session.outputNames[0]];
  if (!value?.data || !Array.isArray(value.dims)) throw workerError('Decoder returned no logits.');
  return value;
}

function findInput(session, candidates) {
  return session.inputNames.find((name) =>
    candidates.some((candidate) => name === candidate || name.includes(candidate)),
  );
}

async function recognize({ modelDir, imageBuffer }) {
  let ort;
  try {
    ort = await import('onnxruntime-node');
  } catch (error) {
    throw workerError(
      `onnxruntime-node is required for formula OCR: ${error.message}`,
      'MISSING_DEPENDENCY',
    );
  }
  const tokenizer = JSON.parse(await readFile(join(modelDir, 'tokenizer.json'), 'utf8'));
  const encoder = await ort.InferenceSession.create(join(modelDir, 'encoder_model.onnx'), {
    executionProviders: ['cpu'],
  });
  const decoder = await ort.InferenceSession.create(join(modelDir, 'decoder_model.onnx'), {
    executionProviders: ['cpu'],
  });
  try {
    const pixelValues = new ort.Tensor('float32', imageToTensor(imageBuffer), [
      1,
      3,
      IMAGE_SIZE,
      IMAGE_SIZE,
    ]);
    const encoderInput = findInput(encoder, ['pixel_values']) || encoder.inputNames[0];
    const encoderOutput =
      encoder.outputNames.find((name) => /last_hidden_state|hidden/i.test(name)) ||
      encoder.outputNames[0];
    const encoderResult = await encoder.run({ [encoderInput]: pixelValues });
    const hiddenStates = encoderResult[encoderOutput];
    if (!hiddenStates?.data || !Array.isArray(hiddenStates.dims))
      throw workerError('Encoder returned no hidden states.');
    const inputIdsName = findInput(decoder, ['input_ids', 'decoder_input_ids']);
    const hiddenStatesName = findInput(decoder, ['encoder_hidden_states']);
    if (!inputIdsName || !hiddenStatesName)
      throw workerError(`Unsupported decoder inputs: ${decoder.inputNames.join(', ')}.`);
    const tokenIds = [BOS_TOKEN_ID];
    for (let step = 0; step < MAX_NEW_TOKENS; step++) {
      const inputIds = new ort.Tensor('int64', BigInt64Array.from(tokenIds, BigInt), [
        1,
        tokenIds.length,
      ]);
      const decoderInputs = {
        [inputIdsName]: inputIds,
        [hiddenStatesName]: hiddenStates,
      };
      for (const name of decoder.inputNames) {
        if (name === inputIdsName || name === hiddenStatesName) continue;
        if (/attention_mask/i.test(name))
          decoderInputs[name] = new ort.Tensor(
            'int64',
            BigInt64Array.from({ length: tokenIds.length }, () => 1n),
            [1, tokenIds.length],
          );
        else throw workerError(`Unsupported decoder input ${name}.`);
      }
      const logits = lastOutput(await decoder.run(decoderInputs), decoder);
      const vocabularySize = logits.dims.at(-1);
      const sequenceLength = logits.dims.length >= 2 ? logits.dims.at(-2) : 1;
      const offset = (sequenceLength - 1) * vocabularySize;
      let nextToken = 0;
      let best = -Infinity;
      for (let token = 0; token < vocabularySize; token++) {
        const score = logits.data[offset + token];
        if (score > best) {
          best = score;
          nextToken = token;
        }
      }
      tokenIds.push(nextToken);
      if (nextToken === EOS_TOKEN_ID) break;
    }
    return { latex: postProcess(decodeTokens(tokenIds, tokenizer)) };
  } finally {
    await encoder.release?.().catch?.(() => {});
    await decoder.release?.().catch?.(() => {});
  }
}

async function main() {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  let request;
  try {
    request = JSON.parse(input);
  } catch {
    throw workerError('Formula OCR worker received invalid input.');
  }
  if (!request?.modelDir || typeof request.imageBase64 !== 'string')
    throw workerError('Formula OCR worker received incomplete input.');
  const result = await recognize({
    modelDir: request.modelDir,
    imageBuffer: Buffer.from(request.imageBase64, 'base64'),
  });
  process.stdout.write(JSON.stringify(result));
}

try {
  await main();
  process.exitCode = 0;
} catch (error) {
  process.stderr.write(
    `${error?.code || 'FORMULA_OCR_FAILED'}: ${error?.message || String(error)}\n`,
  );
  process.exitCode = 1;
}
