import test from 'node:test';
import assert from 'node:assert/strict';
import { createAIDiscussionService } from '../../../electron/main/services/ai-discussion.mjs';

const CLIENTS = ['ChatGPT', 'Claude', 'Gemini'];

function makeService({ platform = 'darwin', installed = CLIENTS, paste = true } = {}) {
  const installedClients = new Set(installed);
  const events = [];
  const service = createAIDiscussionService({
    platform,
    runFile: async (command, args, options) => {
      events.push({ kind: 'runFile', command, args, options });
      if (args[0] === '-Ra' && !installedClients.has(args[1])) throw Error(`Missing ${args[1]}`);
      if (command === '/usr/bin/osascript' && !paste) throw Error('Paste failed');
    },
    clipboard: {
      writeText(text) {
        events.push({ kind: 'clipboard', text });
      },
    },
  });
  return { service, events };
}

function runEvents(events) {
  return events.filter(({ kind }) => kind === 'runFile');
}

test('macOS lists only installed AI clients through open -Ra', async () => {
  const { service, events } = makeService({ installed: ['ChatGPT', 'Gemini'] });

  assert.deepEqual(await service.list(), ['ChatGPT', 'Gemini']);
  const commands = runEvents(events);
  assert.equal(commands.length, CLIENTS.length);
  for (const client of CLIENTS) {
    const command = commands.find(({ args }) => args[1] === client);
    assert.deepEqual(command, {
      kind: 'runFile',
      command: '/usr/bin/open',
      args: ['-Ra', client],
      options: { timeout: 10000 },
    });
  }
});

test('non-macOS has no AI discussion clients and does not run commands', async () => {
  const { service, events } = makeService({ platform: 'linux' });

  assert.deepEqual(await service.list(), []);
  assert.deepEqual(events, []);
});

test('open rejects invalid clients and discussion text before running commands', async () => {
  const { service, events } = makeService();

  await assert.rejects(service.open('Perplexity', 'Question'), /Invalid AI client/);
  await assert.rejects(service.open('ChatGPT', ''), /Invalid discussion text/);
  await assert.rejects(service.open('ChatGPT', ' \n\t'), /Invalid discussion text/);
  await assert.rejects(service.open('ChatGPT', null), /Invalid discussion text/);
  await assert.rejects(service.open('ChatGPT', 'x'.repeat(1_000_001)), /Invalid discussion text/);
  assert.deepEqual(events, []);
});

test('short Claude text opens a prefilled deep link after rechecking installation', async () => {
  const { service, events } = makeService({ installed: ['Claude'] });
  const text = 'Explain 2 + 2 = 4 & 50%';

  assert.deepEqual(await service.open('Claude', text), {
    client: 'Claude',
    delivery: 'prefilled',
  });
  assert.deepEqual(runEvents(events), [
    {
      kind: 'runFile',
      command: '/usr/bin/open',
      args: ['-Ra', 'Claude'],
      options: { timeout: 10000 },
    },
    {
      kind: 'runFile',
      command: '/usr/bin/open',
      args: ['-a', 'Claude', `claude://claude.ai/new?q=${encodeURIComponent(text)}`],
      options: { timeout: 10000 },
    },
  ]);
  assert.deepEqual(
    events.filter(({ kind }) => kind === 'clipboard'),
    [],
  );
});

test('open refuses an uninstalled client after its availability check', async () => {
  const { service, events } = makeService({ installed: [] });

  await assert.rejects(service.open('Gemini', 'Question'), /未找到本机 Gemini/);
  assert.deepEqual(runEvents(events), [
    {
      kind: 'runFile',
      command: '/usr/bin/open',
      args: ['-Ra', 'Gemini'],
      options: { timeout: 10000 },
    },
  ]);
  assert.deepEqual(
    events.filter(({ kind }) => kind === 'clipboard'),
    [],
  );
});

test('ChatGPT and Gemini copy text, launch, and paste through a guarded AppleScript', async () => {
  for (const client of ['ChatGPT', 'Gemini']) {
    const { service, events } = makeService({ installed: [client] });
    const text = `${client} context with a literal ${client} name`;

    assert.deepEqual(await service.open(client, text), { client, delivery: 'pasted' });
    assert.deepEqual(
      events.map(({ kind, command, args, text: clipboardText }) =>
        kind === 'clipboard' ? { kind, text: clipboardText } : { kind, command, args },
      ),
      [
        { kind: 'runFile', command: '/usr/bin/open', args: ['-Ra', client] },
        { kind: 'clipboard', text },
        { kind: 'runFile', command: '/usr/bin/open', args: ['-a', client] },
        {
          kind: 'runFile',
          command: '/usr/bin/osascript',
          args: ['-e', events[3].args[1], '--', client],
        },
      ],
    );
    const script = events[3].args[1];
    assert.match(script, /tell process clientName/);
    assert.match(script, /set frontmost to true/);
    assert.match(script, /if frontmost then/);
    assert.match(script, /AXFocusedUIElement/);
    assert.match(script, /AXTextArea/);
    assert.match(script, /keystroke "v" using command down/);
    assert.doesNotMatch(script, /literal/);
  }
});

test('paste failure leaves copied text available and reports clipboard delivery', async () => {
  const { service, events } = makeService({ installed: ['Gemini'], paste: false });
  const text = 'Keep this context available for manual pasting.';

  assert.deepEqual(await service.open('Gemini', text), {
    client: 'Gemini',
    delivery: 'clipboard',
  });
  assert.deepEqual(
    events
      .slice(0, 3)
      .map(({ kind, command, args, text: clipboardText }) =>
        kind === 'clipboard' ? { kind, text: clipboardText } : { kind, command, args },
      ),
    [
      { kind: 'runFile', command: '/usr/bin/open', args: ['-Ra', 'Gemini'] },
      { kind: 'clipboard', text },
      { kind: 'runFile', command: '/usr/bin/open', args: ['-a', 'Gemini'] },
    ],
  );
  assert.equal(events[3].command, '/usr/bin/osascript');
  assert.equal(events[3].args[3], 'Gemini');
});

test('Claude uses prefilled delivery through 14,000 characters and clipboard delivery above it', async () => {
  const shortText = 'c'.repeat(14_000);
  const short = makeService({ installed: ['Claude'] });
  assert.deepEqual(await short.service.open('Claude', shortText), {
    client: 'Claude',
    delivery: 'prefilled',
  });
  assert.equal(runEvents(short.events)[1].args[2], `claude://claude.ai/new?q=${shortText}`);

  const longText = 'c'.repeat(14_001);
  const long = makeService({ installed: ['Claude'] });
  assert.deepEqual(await long.service.open('Claude', longText), {
    client: 'Claude',
    delivery: 'pasted',
  });
  assert.deepEqual(
    long.events.find(({ kind }) => kind === 'clipboard'),
    {
      kind: 'clipboard',
      text: longText,
    },
  );
  assert.deepEqual(
    runEvents(long.events).map(({ command, args }) => ({ command, args: args.slice(0, 2) })),
    [
      { command: '/usr/bin/open', args: ['-Ra', 'Claude'] },
      { command: '/usr/bin/open', args: ['-a', 'Claude'] },
      { command: '/usr/bin/osascript', args: ['-e', runEvents(long.events)[2].args[1]] },
    ],
  );
});

test('the one-million-character discussion limit is inclusive', async () => {
  const { service, events } = makeService({ installed: ['ChatGPT'] });
  const text = 'x'.repeat(1_000_000);

  assert.deepEqual(await service.open('ChatGPT', text), {
    client: 'ChatGPT',
    delivery: 'pasted',
  });
  assert.deepEqual(
    events.find(({ kind }) => kind === 'clipboard'),
    {
      kind: 'clipboard',
      text,
    },
  );
});
