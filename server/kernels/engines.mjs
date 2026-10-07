import {
  createEngineRuntime,
  createLimiter,
  definitions,
  findUv,
  kernelPythonPath,
  prepareKernelAssets,
  pythonResourcePath,
  LANGUAGE_CODES,
} from './engine-runtime.mjs';

export {
  createEngineRuntime,
  createLimiter,
  definitions,
  findUv,
  kernelPythonPath,
  prepareKernelAssets,
  pythonResourcePath,
  LANGUAGE_CODES,
};

// Compatibility façade for the existing backend startServer contract.
export function createEngines(options) {
  return createEngineRuntime(options);
}
