// Native kernels report upstream exceptions in stderr. Do not classify PDF,
// parser, installation, cache, or cancellation failures as provider failures.
export function nativeProviderFailure(error) {
  if (error?.name === 'AbortError') return false;
  const message = String(error?.message || '');
  return (
    /\b(?:AuthenticationError|RateLimitError|APIConnectionError|APITimeoutError|APIStatusError|invalid_api_key)\b/.test(
      message,
    ) ||
    /\b(?:HTTP(?:Error|StatusError)?|status(?:_code)?|Error code)[^\n]{0,40}\b(?:401|403|429|502|503|504)\b/i.test(
      message,
    )
  );
}
export function mathProviderOutcome({
  cached = false,
  providerCalls = 0,
  providerError = '',
  native = false,
  error,
  cacheOnly = false,
} = {}) {
  if (cacheOnly || error?.name === 'AbortError') return null;
  if (error) return providerError || (native && nativeProviderFailure(error)) ? 'error' : null;
  return !cached && (providerCalls > 0 || native) ? 'success' : null;
}
