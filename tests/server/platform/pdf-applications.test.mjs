import test from 'node:test';
import assert from 'node:assert/strict';
import { createPDFApplicationService } from '../../../electron/main/services/pdf-applications.mjs';

test('macOS lists handlers, excludes PDFMathReader, and hands off with separated arguments', async () => {
  const calls = [];
  const service = createPDFApplicationService({
    platform: 'darwin',
    app: {
      getName: () => 'PDFMathReader',
      getPath: () => '/Applications/PDFMathReader.app/Contents/MacOS/PDFMathReader',
    },
    execFileImpl: async (command, args, options) => {
      calls.push({ command, args, options });
      if (command === '/usr/bin/osascript')
        return {
          stdout: JSON.stringify([
            { id: '/Applications/PDFMathReader.app', name: 'PDFMathReader' },
            { id: '/System/Applications/Preview.app', name: 'Preview' },
          ]),
        };
      return { stdout: '' };
    },
  });

  const path = '/tmp/quarterly report [final] & 100%.pdf';
  const candidates = await service.list(path);
  assert.deepEqual(candidates, [{ id: '/System/Applications/Preview.app', name: 'Preview' }]);
  assert.equal(calls[0].command, '/usr/bin/osascript');
  assert.deepEqual(calls[0].args.slice(0, 3), ['-l', 'JavaScript', '-e']);
  assert.match(calls[0].args[3], /function run\(args\)/);
  assert.match(calls[0].args[3], /URLsForApplicationsToOpenURL/);
  assert.doesNotMatch(calls[0].args[3], /main\(argv\)/);
  assert.equal(calls[0].args.at(-1), path);
  assert.equal(calls[0].options.timeout, 10000);

  assert.equal(await service.open(candidates[0], path), true);
  assert.deepEqual(calls[1].args, ['-a', '/System/Applications/Preview.app', path]);
  assert.equal(calls[1].command, '/usr/bin/open');
});

test('macOS keeps candidates from an earlier document discovery usable after a later discovery', async () => {
  const calls = [];
  const firstPath = '/tmp/first report [old] & 100%.pdf';
  const secondPath = '/tmp/second report [new] ?.pdf';
  const service = createPDFApplicationService({
    platform: 'darwin',
    app: {
      getName: () => 'PDFMathReader',
      getPath: () => '/Applications/PDFMathReader.app/Contents/MacOS/PDFMathReader',
    },
    execFileImpl: async (command, args, options) => {
      calls.push({ command, args, options });
      if (command === '/usr/bin/osascript') {
        const path = args.at(-1);
        return {
          stdout: JSON.stringify(
            path === firstPath
              ? [{ id: '/Applications/Preview.app', name: 'Preview' }]
              : [{ id: '/Applications/Skim.app', name: 'Skim' }],
          ),
        };
      }
      return { stdout: '' };
    },
  });

  const firstCandidates = await service.list(firstPath);
  const secondCandidates = await service.list(secondPath);
  assert.deepEqual(firstCandidates, [{ id: '/Applications/Preview.app', name: 'Preview' }]);
  assert.deepEqual(secondCandidates, [{ id: '/Applications/Skim.app', name: 'Skim' }]);

  assert.equal(await service.open(firstCandidates[0], secondPath), true);
  assert.equal(await service.open(secondCandidates[0], secondPath), true);
  assert.deepEqual(
    calls.filter(({ command }) => command === '/usr/bin/open').map(({ args }) => args),
    [
      ['-a', '/Applications/Preview.app', secondPath],
      ['-a', '/Applications/Skim.app', secondPath],
    ],
  );
});

test('macOS rejects an unknown candidate without invoking system open', async () => {
  const calls = [];
  const path = '/tmp/known.pdf';
  const service = createPDFApplicationService({
    platform: 'darwin',
    app: {
      getName: () => 'PDFMathReader',
      getPath: () => '/Applications/PDFMathReader.app/Contents/MacOS/PDFMathReader',
    },
    execFileImpl: async (command, args, options) => {
      calls.push({ command, args, options });
      if (command === '/usr/bin/osascript')
        return { stdout: JSON.stringify([{ id: '/Applications/Preview.app', name: 'Preview' }]) };
      return { stdout: '' };
    },
  });

  await service.list(path);
  await assert.rejects(
    service.open({ id: '/Applications/Unknown.app', name: 'Unknown' }, path),
    (error) => error?.code === 'UNKNOWN_PDF_APPLICATION',
  );
  assert.equal(
    calls.some(({ command }) => command === '/usr/bin/open'),
    false,
  );
});

test('macOS preserves system open launch failures', async () => {
  const failure = Error('system open failed');
  const service = createPDFApplicationService({
    platform: 'darwin',
    app: {
      getName: () => 'PDFMathReader',
      getPath: () => '/Applications/PDFMathReader.app/Contents/MacOS/PDFMathReader',
    },
    execFileImpl: async (command) => {
      if (command === '/usr/bin/osascript')
        return { stdout: JSON.stringify([{ id: '/Applications/Preview.app', name: 'Preview' }]) };
      assert.equal(command, '/usr/bin/open');
      throw failure;
    },
  });

  const path = '/tmp/failure.pdf';
  const candidates = await service.list(path);
  await assert.rejects(service.open(candidates[0], path), (error) => {
    assert.equal(error, failure);
    return true;
  });
});

test('Linux substitutes the PDF into a desktop Exec command without duplicating the executable', async () => {
  let launched;
  const service = createPDFApplicationService({
    platform: 'linux',
    linuxApplicationDirectories: ['/tmp/applications'],
    environment: { LANG: 'en_US.UTF-8' },
    execFileImpl: async (command) => {
      assert.equal(command, 'gio');
      return { stdout: 'Default application for application/pdf: org.gnome.Evince.desktop\n' };
    },
    readFileImpl: async (path) => {
      assert.equal(path, '/tmp/applications/org.gnome.Evince.desktop');
      return '[Desktop Entry]\nType=Application\nName=Evince\nExec="/usr/bin/evince" --new-window %U\n';
    },
    spawnImpl: (command, args, options) => {
      launched = { command, args, options };
      return { unref() {} };
    },
  });

  const path = '/tmp/research notes.pdf';
  const candidates = await service.list(path);
  assert.deepEqual(candidates, [{ id: 'org.gnome.Evince.desktop', name: 'Evince' }]);
  assert.equal(await service.open(candidates[0], path), true);
  assert.equal(launched.command, '/usr/bin/evince');
  assert.deepEqual(launched.args, ['--new-window', 'file:///tmp/research%20notes.pdf']);
  assert.equal(launched.options.shell, false);
});

test('Windows uses registered command metadata and launches without shell interpolation', async () => {
  let launched;
  const service = createPDFApplicationService({
    platform: 'win32',
    environment: { ProgramFiles: 'C:\\Program Files' },
    execFileImpl: async (command, args) => {
      assert.equal(command, 'powershell.exe');
      assert.ok(args.includes('-EncodedCommand'));
      return {
        stdout: JSON.stringify([
          {
            id: 'PDFMathReader.Document',
            name: 'PDFMathReader',
            command: '"C:\\PDFMathReader.exe" "%1"',
          },
          {
            id: 'AcroExch.Document.DC',
            name: 'Adobe Acrobat',
            command: '"%ProgramFiles%\\Adobe\\Acrobat.exe" "%1"',
          },
        ]),
      };
    },
    spawnImpl: (command, args, options) => {
      launched = { command, args, options };
      return { unref() {} };
    },
  });

  const path = 'C:\\Users\\Reader\\quarterly report.pdf';
  const candidates = await service.list(path);
  assert.deepEqual(candidates, [{ id: 'AcroExch.Document.DC', name: 'Adobe Acrobat' }]);
  assert.equal(await service.open(candidates[0], path), true);
  assert.equal(launched.command, 'C:\\Program Files\\Adobe\\Acrobat.exe');
  assert.deepEqual(launched.args, [path]);
  assert.equal(launched.options.shell, false);
});
