import { join } from 'node:path';

export async function createFormulaOcrSessions(
  ort,
  modelDir,
  { preferGpu = false, platform = process.platform, warn = console.warn } = {},
) {
  const preferred = { win32: 'dml', darwin: 'coreml', linux: 'cuda' }[platform];
  const supported = ort.listSupportedBackends?.() || [];
  const gpu = preferGpu && supported.some(({ name }) => name === preferred) ? preferred : null;

  async function create(executionProviders) {
    const options = { executionProviders };
    if (executionProviders.includes('dml')) {
      options.enableMemPattern = false;
      options.executionMode = 'sequential';
    }
    const encoder = await ort.InferenceSession.create(
      join(modelDir, 'encoder_model.onnx'),
      options,
    );
    try {
      const decoder = await ort.InferenceSession.create(
        join(modelDir, 'decoder_model.onnx'),
        options,
      );
      return { encoder, decoder };
    } catch (error) {
      await encoder.release().catch(() => {});
      throw error;
    }
  }

  if (gpu) {
    try {
      return await create([gpu, 'cpu']);
    } catch (error) {
      warn(`Formula OCR GPU initialization failed (${gpu}); falling back to CPU: ${error.message}`);
    }
  } else if (preferGpu) {
    warn('Formula OCR GPU backend is unavailable; falling back to CPU.');
  }
  return await create(['cpu']);
}
