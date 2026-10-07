import assert from 'node:assert/strict';
import { app, Menu } from 'electron';
import { PDFDocument } from 'pdf-lib';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApplicationMenu } from '../../electron/main/menus/application-menu.mjs';
import { menuLabel } from '../../shared/i18n/menu.mjs';
import { serializeApplicationMenu, menuPathItems } from '../../shared/commands/menu.mjs';

async function verifyExternalApplicationTargeting() {
  const opened = [];
  const target = {
    isDestroyed: () => false,
    webContents: { executeJavaScript: async () => {}, send: () => {} },
  };
  const state = {
    preferences: {},
    performance: { hasDocument: true },
    unkeyedAnnotationSource: { path: '/first.pdf', reliable: true },
  };
  const controller = createApplicationMenu({
    app,
    platform: 'darwin',
    Menu: {
      buildFromTemplate: (template) => Menu.buildFromTemplate(template),
      setApplicationMenu: () => {},
      getApplicationMenu: () => null,
    },
    BrowserWindow: { getFocusedWindow: () => target },
    registry: {
      focusedWindow: () => target,
      stateFor: () => state,
      windows: new Map([[target, state]]),
    },
    pdfApplications: {
      list: async () => [{ id: 'preview', name: 'Preview' }],
      open: async (choice, path) => opened.push([choice.id, path]),
    },
    validateSystemPDF: async () => {},
    resolveUILanguage: () => 'zh-CN',
    menuLabel,
    commandAccelerator: () => undefined,
    closeWindowAccelerator: () => undefined,
    serializeApplicationMenu,
    menuPathItems,
  });
  controller.rebuild();
  await new Promise((resolve) => setImmediate(resolve));
  const submenu = controller.getApplicationMenu().getMenuItemById('file-other-app');
  assert.equal(submenu.label, '在其他应用中继续阅读');
  const choice = submenu.submenu.items[0];
  assert.equal(choice.label, 'Preview');
  state.unkeyedAnnotationSource.path = '/second.pdf';
  choice.click(undefined, target);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(opened, [['preview', '/second.pdf']]);
  state.performance.hasDocument = false;
  choice.click(undefined, target);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(opened.length, 1);
}

export async function verifyFileMenu(window, recents) {
  const evaluate = (code) => window.webContents.executeJavaScript(code);
  const wait = async (code) => {
    for (let i = 0; i < 300; i++) {
      if (await evaluate(code)) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw Error('File menu timed out: ' + code);
  };
  const menu = () => Menu.getApplicationMenu(),
    file = () => menu().getMenuItemById('file-menu').submenu;
  const dir = await mkdtemp(join(tmpdir(), 'file-menu-'));
  try {
    await verifyExternalApplicationTargeting();
    await wait('window.previewReady===true');
    assert.ok(
      menu()
        .getMenuItemById('edit-menu')
        .submenu.items.some((item) => item.id === 'edit-preferences'),
    );
    assert.ok(!file().items.some((item) => item.id === 'file-preferences'));
    const externalIndex = file().items.findIndex((item) => item.id === 'file-other-app');
    const closeIndex = file().items.findIndex((item) => item.id === 'file-close-document');
    assert.equal(externalIndex + 1, closeIndex);
    assert.equal(file().items[externalIndex - 1].type, 'separator');
    assert.equal(menu().getMenuItemById('file-other-app').enabled, false);
    assert.equal(menu().getMenuItemById('file-recents').enabled, false);
    assert.ok(!menu().getMenuItemById('file-recents').submenu);
    assert.equal(menu().getMenuItemById('file-recents-empty').enabled, false);
    menu().getMenuItemById('edit-preferences').click(undefined, window);
    await wait('!!document.querySelector("[data-setting=restore-documents]")');
    window.webContents.send('reader:action', 'settings');
    const path = join(dir, 'Portrait and landscape.pdf'),
      pdf = await PDFDocument.create();
    pdf.addPage();
    await writeFile(path, await pdf.save());
    await recents.remember(path);
    const id = recents.list()[0].id;
    const item = menu().getMenuItemById('recent-document-' + id);
    assert.equal(item.label, 'Portrait and landscape.pdf');
    assert.equal(item.enabled, true);
    assert.ok(!menu().getMenuItemById('file-recents-empty'));
    await item.click(undefined, window);
    await wait(
      'window.previewRenderDiagnostics?.().totalPages===1 && !window.previewRenderDiagnostics().opening',
    );
    assert.equal(menu().getMenuItemById('file-other-app').enabled, true);
    // Wait for asynchronous OS discovery, without opening another application.
    for (
      let attempt = 0;
      attempt < 200 && menu().getMenuItemById('file-other-app-empty');
      attempt++
    )
      await new Promise((resolve) => setTimeout(resolve, 50));
    const applications = menu().getMenuItemById('file-other-app').submenu.items;
    assert.ok(applications.length > 0);
    if (process.platform === 'darwin') assert.ok(!menu().getMenuItemById('file-other-app-empty'));
    if (!menu().getMenuItemById('file-other-app-empty')) {
      assert.ok(applications.every((entry) => entry.enabled && entry.label));
      assert.ok(!applications.some((entry) => /PDFMathReader/i.test(entry.label)));
    }
    await recents.remove(id);
    assert.ok(!menu().getMenuItemById('recent-document-' + id));
    assert.equal(menu().getMenuItemById('file-recents-empty').enabled, false);
    assert.equal(menu().getMenuItemById('edit-rotate-page').enabled, true);
    menu().getMenuItemById('file-close-document').click(undefined, window);
    await wait('window.previewRenderDiagnostics?.().totalPages===0');
    assert.equal(menu().getMenuItemById('file-other-app').enabled, false);
    console.log(
      'File menu smoke passed: inline recent section, preferences in Edit, opening document, dynamic updates, external application submenu and targeting, preserved page actions.',
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  app.exit(0);
}
