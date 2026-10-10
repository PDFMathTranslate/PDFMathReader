import assert from 'node:assert/strict';
import { app, Menu } from 'electron';
import { PDFDocument } from 'pdf-lib';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApplicationMenu } from '../../electron/main/menus/application-menu.mjs';
import { createDocumentFileActions } from '../../electron/main/services/document-file-actions.mjs';
import { menuLabel } from '../../shared/i18n/menu.mjs';
import { serializeApplicationMenu, menuPathItems } from '../../shared/commands/menu.mjs';

export async function verifyExternalApplicationTargeting(platform = 'darwin') {
  const opened = [];
  const actions = [];
  let onResolve;
  let kind = 'original';
  const target = {
    isDestroyed: () => false,
    webContents: {
      executeJavaScript: async (code) =>
        code.includes('previewCurrentFileKind') ? kind : undefined,
      send: (...args) => actions.push(args),
    },
  };
  const state = {
    preferences: {},
    performance: { hasDocument: true },
    unkeyedAnnotationSource: { path: '/first.pdf', reliable: true },
  };
  const controller = createApplicationMenu({
    app,
    platform,
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
      open: async (choice, path) => {
        opened.push([choice.id, path]);
      },
    },
    fileActions: {
      resolvePath: async (_target, selectedKind) => {
        await onResolve?.();
        return selectedKind === 'translated'
          ? '/cached-translated.pdf'
          : state.unkeyedAnnotationSource.path;
      },
    },
    validateSystemPDF: async () => {},
    hideNativeMenuBar: () => {},
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
  if (['win32', 'linux'].includes(platform)) {
    const nativeMenu = controller.getApplicationMenu();
    assert.equal(
      nativeMenu.getMenuItemById('file-reveal-original').label,
      '在资源管理器中显示原始文件',
    );
    assert.equal(nativeMenu.getMenuItemById('file-share-original').label, '分享原始文件');
    assert.ok(!nativeMenu.getMenuItemById('file-airdrop-original'));
    controller.updateMenu(target);
    assert.equal(nativeMenu.getMenuItemById('file-share-original').enabled, true);
    assert.equal(nativeMenu.getMenuItemById('file-share-translated').enabled, false);
  }
  const choice = submenu.submenu.items[0];
  assert.equal(choice.label, 'Preview');
  state.unkeyedAnnotationSource.path = '/second.pdf';
  await choice.click(undefined, target);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(opened, [['preview', '/second.pdf']]);
  assert.deepEqual(actions, [], 'Opening in another app preserves the reader document');
  kind = 'translated';
  await choice.click(undefined, target);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(opened.at(-1), ['preview', '/cached-translated.pdf']);
  onResolve = () => {
    state.unkeyedAnnotationSource = { path: '/replacement.pdf', reliable: true };
  };
  await choice.click(undefined, target);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(opened.length, 2, 'Do not open a replacement document during path resolution');
  state.performance.hasDocument = false;
  await choice.click(undefined, target);
  assert.equal(opened.length, 2);
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
    await verifyExternalApplicationTargeting('win32');
    await verifyExternalApplicationTargeting('linux');
    const translatedPages = [];
    for (const width of [200, 300]) {
      const pdf = await PDFDocument.create();
      pdf.addPage([width, 400]);
      translatedPages.push(Array.from(await pdf.save()));
    }
    const source = { path: join(dir, 'original.pdf'), reliable: true };
    const fileState = { unkeyedAnnotationSource: source };
    const fileTarget = {
      isDestroyed: () => false,
      webContents: { executeJavaScript: async () => translatedPages },
    };
    const revealed = [],
      shared = [];
    const fileActions = createDocumentFileActions({
      app: { getPath: () => dir },
      platform: 'darwin',
      registry: { stateFor: () => fileState },
      documentPath: () => source.path,
      validateSystemPDF: async () => {},
      reveal: (path) => revealed.push(path),
      runAirDrop: async (...args) => shared.push(args),
    });
    await fileActions.perform(fileTarget, 'original', 'reveal');
    assert.equal(revealed[0], source.path);
    await fileActions.perform(fileTarget, 'translated', 'reveal');
    const assembled = await PDFDocument.load(await readFile(revealed[1]));
    assert.deepEqual(
      assembled.getPages().map((page) => page.getWidth()),
      [200, 300],
    );
    await fileActions.perform(fileTarget, 'translated', 'airdrop');
    assert.equal(shared[0][0], '/usr/bin/osascript');
    assert.equal(shared[0][1].at(-1), revealed[1]);
    const windowsActions = createDocumentFileActions({
      app: { getPath: () => dir },
      platform: 'win32',
      registry: { stateFor: () => fileState },
      documentPath: () => source.path,
      validateSystemPDF: async () => {},
      reveal: (path) => revealed.push(path),
      shareWindows: async (target, path) => shared.push([target, path]),
    });
    await windowsActions.perform(fileTarget, 'original', 'reveal');
    assert.equal(revealed.at(-1), source.path);
    await windowsActions.perform(fileTarget, 'translated', 'share');
    assert.equal(shared.at(-1)[0], fileTarget);
    assert.equal(shared.at(-1)[1], revealed[1]);
    await assert.rejects(windowsActions.perform(fileTarget, 'original', 'airdrop'), /Unsupported/);
    fileTarget.webContents.executeJavaScript = async () => null;
    await assert.rejects(
      fileActions.perform(fileTarget, 'translated', 'reveal'),
      /Translate at least one page/,
    );
    await wait('window.previewReady===true');
    assert.ok(
      menu()
        .getMenuItemById('edit-menu')
        .submenu.items.some((item) => item.id === 'edit-preferences'),
    );
    assert.ok(!file().items.some((item) => item.id === 'file-preferences'));
    const externalIndex = file().items.findIndex((item) => item.id === 'file-other-app');
    const closeIndex = file().items.findIndex((item) => item.id === 'file-close-document');
    assert.ok(closeIndex > externalIndex);
    for (const action of ['reveal', process.platform === 'win32' ? 'share' : 'airdrop']) {
      for (const kind of ['original', 'translated']) {
        const entry = menu().getMenuItemById(`file-${action}-${kind}`);
        if (['darwin', 'win32'].includes(process.platform)) assert.equal(entry.enabled, false);
        else assert.ok(!entry);
      }
    }
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
    if (['darwin', 'win32'].includes(process.platform)) {
      const shareAction = process.platform === 'darwin' ? 'airdrop' : 'share';
      assert.equal(menu().getMenuItemById('file-reveal-original').enabled, true);
      assert.equal(menu().getMenuItemById(`file-${shareAction}-original`).enabled, true);
      assert.equal(menu().getMenuItemById('file-reveal-translated').enabled, false);
      await evaluate('window.previewActions.translatedFileReady(true)');
      assert.equal(menu().getMenuItemById('file-reveal-translated').enabled, true);
      assert.equal(menu().getMenuItemById(`file-${shareAction}-translated`).enabled, true);
      await evaluate('window.previewActions.translatedFileReady(false)');
    }
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
