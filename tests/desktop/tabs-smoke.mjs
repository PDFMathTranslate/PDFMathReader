import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { app } from 'electron';

// Tab mode: reader windows join one group, only the active tab is visible, and
// the renderer draws a Finder-style tab bar directly beneath its header.
export async function verifyTabs(first, windows) {
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const run = (window, expression) => window.webContents.executeJavaScript(expression);
  const wait = async (window, expression, label = expression) => {
    for (let i = 0; i < 200; i++) {
      if (await run(window, expression)) return;
      await pause(100);
    }
    throw Error('Tabs check timed out: ' + label);
  };
  const until = async (check, label) => {
    for (let i = 0; i < 200; i++) {
      if (check()) return;
      await pause(50);
    }
    throw Error('Tabs check timed out: ' + label);
  };
  const capture = async (window, name) => {
    const directory = process.env.PDFMATHREADER_TABS_CAPTURE;
    if (!directory) return;
    const image = await window.webContents.capturePage();
    await writeFile(join(directory, name), image.toPNG());
  };
  // Mirror the settings control: the renderer holds the new mode, then saves it.
  const setMode = async (window, mode) => {
    window.webContents.send('preferences:changed', { windowMode: mode });
    await pause(100);
    await run(window, `window.previewPreferences.save({windowMode:'${mode}'})`);
  };
  const openSample = (window) =>
    run(
      window,
      `(async()=>{const bytes=new Uint8Array(await (await fetch('/sample.pdf')).arrayBuffer());await window.previewDocuments.open(new File([bytes],'A quieter way to read.pdf',{type:'application/pdf'}));})()`,
    );
  const readers = () => [...windows].filter(([, state]) => !state.settingsOwner).map(([w]) => w);

  await wait(first, "!!document.querySelector('.empty > button:not(.primary)')");
  await run(first, "document.querySelector('.empty > button:not(.primary)').click()");
  await wait(first, 'window.previewRenderDiagnostics?.().totalPages>0');
  await setMode(first, 'tabs');
  assert.deepEqual(await run(first, 'window.previewTabs.list()'), []);
  assert.equal(
    await run(first, "document.querySelector('.app').classList.contains('has-tabs')"),
    false,
  );

  // A new tab joins the group, takes over the frame, and hides the first tab.
  await run(first, 'window.previewTabs.new()');
  await until(() => readers().length === 2, 'second tab window');
  const second = readers().find((window) => window !== first);
  await until(() => second.isVisible() && !first.isVisible(), 'second tab visible alone');
  assert.deepEqual(second.getBounds(), first.getBounds());
  await openSample(second);
  await wait(second, 'window.previewRenderDiagnostics?.().totalPages>0');
  await wait(second, 'window.previewRenderDiagnostics?.().residentBytes>0');
  const listed = await run(second, 'window.previewTabs.list()');
  assert.deepEqual(
    listed.map((tab) => [tab.id, tab.active]),
    [
      [first.id, false],
      [second.id, true],
    ],
  );
  assert.equal(first.excludedFromShownWindowsMenu, true);
  assert.equal(second.excludedFromShownWindowsMenu, false);
  await wait(second, "document.querySelectorAll('[data-window-tab-bar] .window-tab').length===2");

  // The bar spans the window directly beneath the header controls and above
  // both the thumbnail sidebar and the reading content.
  const geometry = async (window) =>
    run(
      window,
      `(()=>{const bar=document.querySelector('[data-window-tab-bar]').getBoundingClientRect(),
        toolbar=document.querySelector('.toolbar').getBoundingClientRect(),
        title=document.querySelector('.toolbar .title')?.getBoundingClientRect(),
        reader=document.querySelector('.reader'),
        firstPage=document.querySelector('.page')?.getBoundingClientRect();
        return {bar:{top:bar.top,bottom:bar.bottom,left:bar.left,right:bar.right},
          toolbarBottom:toolbar.bottom,titleBottom:title?.bottom??0,width:innerWidth,
          readerPadding:parseFloat(getComputedStyle(reader).paddingTop),
          pageTop:firstPage?.top??null,
          active:document.querySelector('.window-tab.active')?.textContent.trim()}})()`,
    );
  const secondGeometry = await geometry(second);
  assert.equal(secondGeometry.bar.left, 0);
  assert.equal(secondGeometry.bar.right, secondGeometry.width);
  assert.equal(secondGeometry.bar.bottom, secondGeometry.toolbarBottom);
  assert.ok(secondGeometry.titleBottom <= secondGeometry.bar.top, JSON.stringify(secondGeometry));
  await pause(400);
  await capture(second, 'tabs-start-page.png');

  // An inactive document releases its rendered canvases and cached frames, then
  // repaints at the same page when selected again.
  const secondActive = await run(second, 'window.previewRenderDiagnostics().active');
  await run(second, `window.previewTabs.select(${first.id})`);
  await until(() => first.isVisible() && !second.isVisible(), 'first tab selected');
  await wait(
    second,
    'window.previewRenderDiagnostics().foreground===false && window.previewRenderDiagnostics().residentBytes===0 && window.previewRenderDiagnostics().cache.bytes===0',
    'inactive tab resources released',
  );
  assert.equal(await run(second, 'window.previewRenderDiagnostics().active'), secondActive);
  await run(first, `window.previewTabs.select(${second.id})`);
  await until(() => second.isVisible() && !first.isVisible(), 'second tab resumed');
  await wait(
    second,
    'window.previewRenderDiagnostics().foreground===true && window.previewRenderDiagnostics().residentBytes>0',
    'second tab repainted',
  );
  assert.equal(await run(second, 'window.previewRenderDiagnostics().active'), secondActive);
  await run(second, `window.previewTabs.select(${first.id})`);
  await until(() => first.isVisible() && !second.isVisible(), 'first tab selected again');
  await wait(
    first,
    "document.querySelector('.window-tab.active')?.getAttribute('aria-selected')==='true'",
  );
  await wait(first, 'window.previewRenderDiagnostics().foreground===true');
  await wait(first, "document.querySelector('.app').classList.contains('has-tabs')");
  await pause(400);
  const firstGeometry = await geometry(first);
  assert.ok(firstGeometry.pageTop >= firstGeometry.bar.bottom, JSON.stringify(firstGeometry));
  assert.ok(
    firstGeometry.readerPadding >= firstGeometry.toolbarBottom,
    JSON.stringify(firstGeometry),
  );
  await capture(first, 'tabs-document.png');

  // Reordering is shared by every tab in the group.
  await run(first, `window.previewTabs.move(${first.id}, 1)`);
  assert.deepEqual(
    (await run(second, 'window.previewTabs.list()')).map((tab) => tab.id),
    [second.id, first.id],
  );

  // Closing a tab leaves a lone window without a tab bar.
  await run(first, `window.previewTabs.close(${second.id})`);
  await until(() => readers().length === 1, 'tab closed');
  await wait(first, "!document.querySelector('[data-window-tab-bar]')");
  await wait(first, "!document.querySelector('.app').classList.contains('has-tabs')");
  assert.equal(first.isVisible(), true);

  // Reopen the closed document with the keyboard shortcut, then close it again.
  first.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'T', modifiers: ['meta', 'shift'] });
  await until(() => readers().length === 2, 'closed tab reopened');
  const reopened = readers().find((window) => window !== first);
  await wait(reopened, 'window.previewRenderDiagnostics?.().totalPages>0');
  await until(() => reopened.isVisible() && !first.isVisible(), 'reopened tab active');
  await run(reopened, `window.previewTabs.close(${reopened.id})`);
  await until(() => readers().length === 1 && first.isVisible(), 'reopened tab closed');

  // New Window (⌘N) opens its start page as a tab, not a standalone window.
  first.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'N', modifiers: ['meta'] });
  await until(() => readers().length === 2, 'third tab window');
  const third = readers().find((window) => window !== first);
  await until(() => third.isVisible() && !first.isVisible(), 'third tab visible alone');
  assert.deepEqual(third.getBounds(), first.getBounds());
  await wait(third, "!!document.querySelector('.empty')");
  await wait(third, "document.querySelectorAll('[data-window-tab-bar] .window-tab').length===2");
  // The renderer's New Window request (Recents) joins the group the same way.
  await run(third, 'window.previewWindow.new()');
  await until(() => readers().length === 3, 'fourth tab window');
  const fourth = readers().find((window) => window !== first && window !== third);
  await until(() => fourth.isVisible() && !third.isVisible(), 'fourth tab visible alone');
  await wait(fourth, "document.querySelectorAll('[data-window-tab-bar] .window-tab').length===3");
  await run(fourth, `window.previewTabs.close(${fourth.id})`);
  await until(() => readers().length === 2 && third.isVisible(), 'fourth tab closed');

  await openSample(third);
  await wait(third, 'window.previewRenderDiagnostics?.().totalPages>0');
  await wait(third, 'window.previewRenderDiagnostics?.().residentBytes>0');
  const thirdActive = await run(third, 'window.previewRenderDiagnostics().active');

  // Returning to window mode turns hidden tabs back into separate windows.
  await setMode(third, 'window');
  await until(() => first.isVisible() && third.isVisible(), 'windows shown');
  await wait(first, "!document.querySelector('[data-window-tab-bar]')");
  await wait(third, "!document.querySelector('[data-window-tab-bar]')");
  assert.notDeepEqual(first.getBounds(), third.getBounds());
  first.show();
  first.focus();
  await wait(
    third,
    'window.previewRenderDiagnostics().foreground===false && window.previewRenderDiagnostics().residentBytes===0 && window.previewRenderDiagnostics().cache.bytes===0',
    'unfocused window resources released',
  );
  assert.equal(await run(third, 'window.previewRenderDiagnostics().active'), thirdActive);
  await wait(
    first,
    'window.previewRenderDiagnostics().foreground===true && window.previewRenderDiagnostics().residentBytes>0',
    'focused window repainted',
  );
  third.show();
  third.focus();
  await wait(
    third,
    'window.previewRenderDiagnostics().foreground===true && window.previewRenderDiagnostics().residentBytes>0',
    'window focus restored',
  );
  assert.equal(await run(third, 'window.previewRenderDiagnostics().active'), thirdActive);
  // In window mode New Window stays a separate, visible window.
  first.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'N', modifiers: ['meta'] });
  await until(() => readers().length === 3, 'separate window');
  const separate = readers().find((window) => window !== first && window !== third);
  await until(() => separate.isVisible() && first.isVisible(), 'separate window shown');
  await wait(separate, "!document.querySelector('[data-window-tab-bar]')");
  separate.destroy();
  third.destroy();
  console.log('Tabs smoke passed');
  app.quit();
}
