export const GPU_INFERENCE_OPTION = Object.freeze({
  id: 'prefer_gpu',
  flag: '--prefer-gpu',
  type: 'boolean',
  default: false,
  flagValue: true,
  label: 'Prefer GPU inference',
  help: 'Prepare GPU dependencies automatically. Use DirectML on Windows and CoreML on macOS, with CPU fallback when unavailable.',
});
