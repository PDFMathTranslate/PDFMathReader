import assert from 'node:assert/strict';
import { app } from 'electron';

export async function verifyReopenTab(first, windows) {
  const run = (target, expression) => target.webContents.executeJavaScript(expression);
  const wait = async (check, label) => {
    for (let i = 0; i < 200; i++) {
      if (await check()) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw Error('Reopen tab timed out: ' + label);
  };
  const readers = () => [...windows.keys()].filter((w) => !windows.get(w).settingsOwner);
  const reopen = (target) =>
    target.webContents.sendInputEvent({
      type: 'keyDown',
      keyCode: 'T',
      modifiers: ['meta', 'shift'],
    });
  await wait(() => run(first, "!!document.querySelector('.empty')"), 'ready');
  first.webContents.send('preferences:changed', { windowMode: 'tabs' });
  await run(first, "window.previewPreferences.save({windowMode:'tabs'})");
  await run(first, 'window.previewTabs.new()');
  await wait(() => readers().length === 2, 'new tab');
  const second = readers().find((w) => w !== first);
  await wait(() => second.isVisible(), 'second visible');
  await wait(() => run(second, "!!document.querySelector('.empty')"), 'second ready');
  await run(second, "document.querySelector('.empty > button:not(.primary)').click()");
  await wait(
    () => run(second, 'window.previewRenderDiagnostics?.().totalPages>0'),
    'document loaded',
  );
  const pages = await run(second, 'window.previewRenderDiagnostics().totalPages');
  await run(first, `window.previewTabs.close(${second.id})`);
  await wait(() => readers().length === 1, 'closed');
  reopen(first);
  await wait(() => readers().length === 2, 'reopened');
  const restored = readers().find((w) => w !== first);
  try {
    await wait(
      () => run(restored, 'window.previewRenderDiagnostics?.().totalPages>0'),
      'restored document',
    );
  } catch (error) {
    console.error(await run(restored, 'document.body.innerText'));
    console.error(
      [...windows.values()].map((state) => ({
        documents: state.documents.map((d) => (typeof d === 'string' ? d : d?.name)),
        source: state.unkeyedAnnotationSource?.path,
      })),
    );
    throw error;
  }
  assert.equal(await run(restored, 'window.previewRenderDiagnostics().totalPages'), pages);
  await wait(() => restored.isVisible() && !first.isVisible(), 'active restored tab');
  // Cmd-W also records the document before its window is released.
  restored.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'W', modifiers: ['meta'] });
  await wait(
    () => run(restored.isDestroyed() ? first : restored, "!!document.querySelector('.empty')"),
    'document closed',
  );
  const owner = readers().find((w) => w.isVisible()) || first;
  reopen(owner);
  await wait(async () => {
    const active = readers().find((w) => w.isVisible());
    return active && (await run(active, 'window.previewRenderDiagnostics?.().totalPages>0'));
  }, 'Cmd-W document reopened');
  console.log('Reopen closed tab smoke passed');
  app.quit();
}
