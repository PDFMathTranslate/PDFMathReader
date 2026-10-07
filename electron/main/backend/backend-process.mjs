const parentPort = process.parentPort;
let backend;
let credentialKey = '';
let credentialStatus = { configured: false, keySource: 'none' };

function messageData(event) {
  return event && typeof event === 'object' && 'data' in event ? event.data : event;
}
function send(message) {
  parentPort?.postMessage(message);
}
function errorMessage(error) {
  const message =
    error instanceof Error && error.message
      ? error.message
      : String(error || 'Unknown backend error');
  return credentialKey ? message.replaceAll(credentialKey, '[redacted]') : message;
}
function setCredentialState(key, status) {
  credentialKey = typeof key === 'string' ? key : '';
  credentialStatus =
    status && typeof status === 'object'
      ? { ...status }
      : { configured: !!credentialKey, keySource: credentialKey ? 'saved' : 'none' };
}

export function makeProviderFetch(mode) {
  const upstream = globalThis.fetch;
  if (!mode) return upstream;
  return async (url, options) => {
    if (!String(url).startsWith('https://api.openai.com/')) return upstream(url, options);
    if (mode === 'ux' || mode === 'developer') {
      await new Promise((resolve) => setTimeout(resolve, mode === 'developer' ? 1500 : 600));
      if (mode === 'ux' && String(options?.body).includes('fixture 13'))
        return new Response(JSON.stringify({ error: { message: 'Synthetic rate limit' } }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        });
    }
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content:
                mode === 'animation'
                  ? '示例译文：新的文字逐个跳跃上来，段落保持自然换行。'.repeat(3) + ' 👩🏽‍💻 é'
                  : mode === 'information-emphasis'
                    ? '首先，结果表明支持研究假设。然而，发现高于原先预期。普通内容保持不变。'
                    : mode === 'topic-sentences'
                      ? '译文第一句。第二句保持普通字重。' +
                        '后续段落提供具体证据并说明研究背景。'.repeat(10)
                      : 'Mock translated paragraph',
            },
          },
        ],
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  };
}

async function start(message) {
  if (backend) return;
  const options = { ...(message?.options || {}) };
  setCredentialState(message?.credentials?.key, message?.credentials?.status);
  // A real API key may exist in the parent process environment. The child only
  // receives the explicit credential snapshot above.
  delete process.env.OPENAI_API_KEY;
  const { startServer } = await import('../../../server/index.mjs');
  const smoke = typeof options.smoke === 'string' ? options.smoke : '';
  const serverOptions = { ...options };
  delete serverOptions.credentials;
  delete serverOptions.providerFetch;
  delete serverOptions.getApiKey;
  delete serverOptions.keyStatus;
  serverOptions.providerFetch = makeProviderFetch(smoke);
  serverOptions.getApiKey = () => credentialKey;
  serverOptions.keyStatus = () => ({ ...credentialStatus });
  if (smoke) serverOptions.diagnostics = true;
  if (serverOptions.diagnostics)
    serverOptions.kernelDiagnostic = (message) =>
      send({
        type: 'diagnostic',
        message: credentialKey
          ? String(message).replaceAll(credentialKey, '[redacted]')
          : String(message),
      });
  backend = await startServer(serverOptions);
  send({ type: 'ready', origin: backend.origin });
}

async function close(message) {
  const current = backend;
  backend = null;
  try {
    await current?.close();
    send({ type: 'closed', id: message?.id });
  } catch (error) {
    send({ type: 'error', id: message?.id, message: errorMessage(error) });
  } finally {
    setImmediate(() => process.exit(0));
  }
}

async function handle(message) {
  const value = messageData(message) || {};
  if (value.type === 'start') return start(value);
  if (value.type === 'credentials') {
    setCredentialState(value.key, value.status);
    send({ type: 'credentials', id: value.id, status: { ...credentialStatus } });
    return;
  }
  if (value.type === 'close') return close(value);
}

if (parentPort) {
  let queue = Promise.resolve();
  parentPort.on('message', (event) => {
    const value = messageData(event) || {};
    queue = queue
      .then(() => handle(value))
      .catch((error) => {
        const message = errorMessage(error);
        if (value.type === 'start') {
          send({ type: 'startup-error', message });
          setImmediate(() => process.exit(1));
        } else send({ type: 'error', id: value.id, message });
      });
  });
}
