import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { app } from 'electron';

export async function verifyQuickGlossary(window) {
  const evaluate = (code) => window.webContents.executeJavaScript(code);
  for (let i = 0; i < 200; i++) {
    if (await evaluate('window.previewReady === true')) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  await evaluate(
    `window.dispatchEvent(new CustomEvent('reader:add-glossary-term', {detail:'  public\\n opinion  '}))`,
  );
  await new Promise((resolve) => setTimeout(resolve, 300));
  const state = await evaluate(`(() => {
    const dialog = document.querySelector('.quick-glossary-dialog');
    const inputs = dialog.querySelectorAll('input');
    return {open: dialog.open, source: inputs[0].value, focused: document.activeElement === inputs[1],
      button: !!dialog.querySelector('button.macvue-button'), popup: !!dialog.querySelector('.macvue-pop-up-button'),
      radius: getComputedStyle(dialog).borderRadius};
  })()`);
  assert.equal(state.open, true);
  assert.equal(state.source, 'public opinion');
  assert.equal(state.focused, true);
  assert.equal(state.button, true);
  assert.equal(state.popup, true);
  assert.equal(state.radius, '24px');
  await evaluate(
    `(() => { const input = document.querySelectorAll('.quick-glossary-dialog input')[1]; input.value='公共意见'; input.dispatchEvent(new Event('input', {bubbles:true})); })()`,
  );
  await new Promise((resolve) => setTimeout(resolve, 100));
  await writeFile(
    '/tmp/quick-glossary-light.png',
    (await window.webContents.capturePage()).toPNG(),
  );
  await evaluate(
    `document.documentElement.dataset.appearance = 'dark'; document.documentElement.dataset.macvueAppearance = 'dark'`,
  );
  await new Promise((resolve) => setTimeout(resolve, 150));
  await writeFile('/tmp/quick-glossary-dark.png', (await window.webContents.capturePage()).toPNG());
  await evaluate(`document.querySelector('.quick-glossary-dialog form').requestSubmit()`);
  await new Promise((resolve) => setTimeout(resolve, 350));
  assert.equal(await evaluate(`document.querySelector('.quick-glossary-dialog').open`), false);
  const glossaries = await evaluate(`JSON.parse(localStorage.getItem('glossaries') || '[]')`);
  assert.ok(
    glossaries.some((library) =>
      library.entries.some(
        (entry) => entry.source === 'public opinion' && entry.target === '公共意见',
      ),
    ),
  );
  console.log('QUICK_GLOSSARY_SMOKE_PASS', JSON.stringify(state));
  app.exit(0);
}
