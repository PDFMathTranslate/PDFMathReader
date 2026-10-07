import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../../doc/icon.png', import.meta.url));
const iconset = fileURLToPath(new URL('../AppIcon.iconset', import.meta.url));
mkdirSync(iconset, { recursive: true });
for (const size of [16, 32, 128, 256, 512]) {
  for (const scale of [1, 2]) {
    const pixels = String(size * scale);
    execFileSync(
      '/usr/bin/sips',
      [
        '-z',
        pixels,
        pixels,
        source,
        '--out',
        `${iconset}/icon_${size}x${size}${scale === 2 ? '@2x' : ''}.png`,
      ],
      { stdio: 'ignore' },
    );
  }
}
const entries = [
  ['icp4', 16, 1],
  ['icp5', 32, 1],
  ['ic07', 128, 1],
  ['ic08', 256, 1],
  ['ic09', 512, 1],
  ['ic10', 512, 2],
  ['ic11', 16, 2],
  ['ic12', 32, 2],
  ['ic13', 128, 2],
  ['ic14', 256, 2],
];
const chunks = entries.map(([type, size, scale]) => {
  const png = readFileSync(`${iconset}/icon_${size}x${size}${scale === 2 ? '@2x' : ''}.png`);
  const header = Buffer.alloc(8);
  header.write(type);
  header.writeUInt32BE(png.length + 8, 4);
  return Buffer.concat([header, png]);
});
const header = Buffer.alloc(8);
header.write('icns');
header.writeUInt32BE(8 + chunks.reduce((total, chunk) => total + chunk.length, 0), 4);
writeFileSync(
  fileURLToPath(new URL('../AppIcon.icns', import.meta.url)),
  Buffer.concat([header, ...chunks]),
);
// PNG-backed ICO entries preserve alpha at each Windows shell size.
const sizes = [16, 24, 32, 48, 64, 128, 256];
const images = sizes.map((size) => {
  const path = `${iconset}/windows_${size}.png`;
  execFileSync('/usr/bin/sips', ['-z', String(size), String(size), source, '--out', path], {
    stdio: 'ignore',
  });
  const png = readFileSync(path);
  unlinkSync(path);
  return png;
});
const directory = Buffer.alloc(6 + 16 * sizes.length);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(sizes.length, 4);
let offset = directory.length;
images.forEach((png, index) => {
  const entry = 6 + index * 16,
    size = sizes[index];
  directory[entry] = size === 256 ? 0 : size;
  directory[entry + 1] = size === 256 ? 0 : size;
  directory.writeUInt16LE(1, entry + 4);
  directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(png.length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  offset += png.length;
});
writeFileSync(
  fileURLToPath(new URL('../AppIcon.ico', import.meta.url)),
  Buffer.concat([directory, ...images]),
);
copyFileSync(
  `${iconset}/icon_512x512.png`,
  fileURLToPath(new URL('../AppIcon.png', import.meta.url)),
);
console.log('Generated macOS ICNS, Windows ICO, and runtime PNG from doc/icon.png');
