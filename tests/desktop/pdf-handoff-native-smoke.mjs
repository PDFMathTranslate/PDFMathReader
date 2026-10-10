#!/usr/bin/env node

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const runFile = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const helperSource = resolve(root, 'electron/platform/macos/pdf-handoff.swift');
const helperBinary = resolve(root, '.cache/pdf-handoff');
const wait = (milliseconds) => new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));

const recipientSource = String.raw`import AppKit
import Foundation

@MainActor
final class RecipientDelegate: NSObject, NSApplicationDelegate {
    private let markerURL: URL
    private var window: NSWindow?
    private var received: [String] = []
    private var openFilesCalls = 0
    private var openFileCalls = 0

    init(markerURL: URL) {
        self.markerURL = markerURL
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        let frame = NSRect(x: 160, y: 160, width: 520, height: 180)
        let window = NSWindow(
            contentRect: frame,
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "PDF Handoff Native Smoke Recipient"
        window.contentView = NSTextField(labelWithString: "Waiting for a PDF handoff")
        self.window = window
        window.makeKeyAndOrderFront(nil)
        writeMarker(event: "launched")
        refreshMarker(event: "launched")
    }

    func application(_ sender: NSApplication, openFiles filenames: [String]) {
        openFilesCalls += 1
        received.append(contentsOf: filenames)
        if let filename = filenames.last {
            window?.title = URL(fileURLWithPath: filename).lastPathComponent
        }
        window?.makeKeyAndOrderFront(nil)
        writeMarker(event: "openFiles")
        refreshMarker(event: "openFiles")
        sender.reply(toOpenOrPrint: .success)
    }

    @discardableResult
    func application(_ sender: NSApplication, openFile filename: String) -> Bool {
        openFileCalls += 1
        received.append(filename)
        window?.title = URL(fileURLWithPath: filename).lastPathComponent
        window?.makeKeyAndOrderFront(nil)
        writeMarker(event: "openFile")
        refreshMarker(event: "openFile")
        return true
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        false
    }

    private func refreshMarker(event: String) {
        for delay in [0.10, 0.30, 0.75, 1.25] {
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                self?.writeMarker(event: event + ".settled")
            }
        }
    }

    private func writeMarker(event: String) {
        let payload: [String: Any] = [
            "event": event,
            "received": received,
            "openFilesCalls": openFilesCalls,
            "openFileCalls": openFileCalls,
            "pid": ProcessInfo.processInfo.processIdentifier,
            "isActive": NSApp.isActive,
            "keyWindow": window?.isKeyWindow ?? false,
            "windowVisible": window?.isVisible ?? false,
            "windowTitle": window?.title ?? "",
            "timestamp": Date().timeIntervalSince1970
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: payload, options: [.prettyPrinted]) else {
            return
        }
        try? data.write(to: markerURL, options: [.atomic])
    }
}

@main
@MainActor
struct RecipientMain {
    static func main() {
        let markerPath = Bundle.main.object(forInfoDictionaryKey: "PDFHandoffMarkerPath") as? String ?? ""
        guard !markerPath.isEmpty else {
            exit(2)
        }
        let application = NSApplication.shared
        application.setActivationPolicy(.regular)
        let delegate = RecipientDelegate(markerURL: URL(fileURLWithPath: markerPath))
        application.delegate = delegate
        application.run()
    }
}
`;

function xmlEscape(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function infoPlist(markerPath) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleDisplayName</key>
  <string>PDF Handoff Native Smoke Recipient</string>
  <key>CFBundleExecutable</key>
  <string>PDFHandoffRecipient</string>
  <key>CFBundleIdentifier</key>
  <string>local.pdfmathreader.pdf-handoff-native-smoke</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>PDF Handoff Native Smoke Recipient</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSMinimumSystemVersion</key>
  <string>13.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>PDFHandoffMarkerPath</key>
  <string>${xmlEscape(markerPath)}</string>
  <key>CFBundleDocumentTypes</key>
  <array>
    <dict>
      <key>CFBundleTypeExtensions</key>
      <array><string>pdf</string></array>
      <key>CFBundleTypeIconFile</key>
      <string></string>
      <key>CFBundleTypeName</key>
      <string>PDF Document</string>
      <key>CFBundleTypeRole</key>
      <string>Viewer</string>
      <key>LSItemContentTypes</key>
      <array><string>com.adobe.pdf</string></array>
    </dict>
  </array>
</dict>
</plist>
`;
}

async function compileHelper() {
  await mkdir(resolve(root, '.cache'), { recursive: true });
  await mkdir(resolve(root, '.cache/swift-modules'), { recursive: true });
  await runFile('/usr/bin/swiftc', [
    '-O',
    '-module-cache-path',
    resolve(root, '.cache/swift-modules'),
    helperSource,
    '-o',
    helperBinary,
  ]);
  const helperStats = await stat(helperBinary);
  assert(helperStats.isFile(), 'compiled PDF handoff helper is a file');
  await chmod(helperBinary, 0o755);
}

async function compileRecipient(tempRoot, markerPath) {
  const appPath = join(tempRoot, 'PDFHandoffRecipient.app');
  const contentsPath = join(appPath, 'Contents');
  const macOSPath = join(contentsPath, 'MacOS');
  const sourcePath = join(tempRoot, 'PDFHandoffRecipient.swift');
  const executablePath = join(macOSPath, 'PDFHandoffRecipient');
  const moduleCachePath = join(tempRoot, 'swift-modules');
  await mkdir(macOSPath, { recursive: true });
  await mkdir(moduleCachePath, { recursive: true });
  await writeFile(sourcePath, recipientSource);
  await writeFile(join(contentsPath, 'Info.plist'), infoPlist(markerPath));
  await runFile('/usr/bin/swiftc', [
    '-O',
    '-parse-as-library',
    '-framework',
    'AppKit',
    '-module-cache-path',
    moduleCachePath,
    sourcePath,
    '-o',
    executablePath,
  ]);
  await chmod(executablePath, 0o755);
  await runFile('/usr/bin/codesign', ['--force', '--deep', '--sign', '-', appPath]);
  return { appPath, executablePath };
}

async function invokeHelper(appPath, pdfPath) {
  try {
    const result = await runFile(helperBinary, [appPath, pdfPath, String(process.pid)], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024,
      timeout: 12000,
    });
    return {
      code: 0,
      signal: null,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch (error) {
    return {
      code: typeof error.code === 'number' ? error.code : null,
      signal: error.signal ?? null,
      stdout: error.stdout ?? '',
      stderr: error.stderr ?? error.message,
      timedOut: error.killed === true && error.signal === 'SIGTERM',
    };
  }
}

async function readMarker(markerPath) {
  try {
    return JSON.parse(await readFile(markerPath, 'utf8'));
  } catch {
    return null;
  }
}

async function waitForMarker(markerPath, predicate, description, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  let latest = null;
  while (Date.now() < deadline) {
    latest = await readMarker(markerPath);
    if (latest && predicate(latest)) return latest;
    await wait(50);
  }
  throw Error(`${description} timed out; latest marker: ${JSON.stringify(latest)}`);
}

async function commandForPID(pid) {
  try {
    const result = await runFile('/bin/ps', ['-p', String(pid), '-o', 'command='], {
      encoding: 'utf8',
    });
    return result.stdout.trim();
  } catch {
    return '';
  }
}

async function recipientPIDs(executablePath) {
  let stdout;
  try {
    stdout = (await runFile('/bin/ps', ['-axo', 'pid=,command='], { encoding: 'utf8' })).stdout;
  } catch {
    return [];
  }
  const pids = [];
  for (const line of stdout.split('\n')) {
    const match = line.trim().match(/^(\d+)\s+(.+)$/);
    if (!match) continue;
    const pid = Number(match[1]);
    const command = match[2].trim();
    if (
      pid !== process.pid &&
      (command === executablePath || command.startsWith(`${executablePath} `))
    )
      pids.push(pid);
  }
  return pids;
}

async function waitForExit(pid, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await commandForPID(pid))) return true;
    await wait(50);
  }
  return !(await commandForPID(pid));
}

async function terminateRecipient(pid, executablePath) {
  if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) return false;
  const command = await commandForPID(pid);
  if (!(command === executablePath || command.startsWith(`${executablePath} `)))
    throw Error(`Refusing to terminate PID ${pid}; command is ${JSON.stringify(command)}`);
  process.kill(pid, 'SIGTERM');
  if (await waitForExit(pid)) return true;
  const stillOwned = await commandForPID(pid);
  if (stillOwned === executablePath || stillOwned.startsWith(`${executablePath} `)) {
    process.kill(pid, 'SIGKILL');
    if (await waitForExit(pid)) return true;
  }
  throw Error(`Generated recipient PID ${pid} did not exit after SIGTERM/SIGKILL.`);
}

function assertNativeForeground(marker, expectedPaths) {
  assert.deepEqual(
    marker.received,
    expectedPaths,
    'recipient received the expected document paths',
  );
  assert.equal(marker.isActive, true, 'recipient application is active');
  assert.equal(marker.keyWindow, true, 'recipient window is key');
  assert.equal(marker.windowVisible, true, 'recipient window is visible');
  assert.equal(marker.windowTitle, basename(expectedPaths.at(-1)));
  assert.equal(marker.openFilesCalls + marker.openFileCalls, expectedPaths.length);
}

async function main() {
  if (process.platform !== 'darwin') {
    console.log(
      'PDF_HANDOFF_NATIVE_SMOKE_SKIPPED',
      JSON.stringify({ platform: process.platform, requiredPlatform: 'darwin' }),
    );
    return;
  }

  await compileHelper();
  const tempRoot = await mkdtemp(join(tmpdir(), 'pdf-handoff-native-smoke-'));
  const markerPath = join(tempRoot, 'recipient-result.json');
  const firstPDF = join(tempRoot, 'first native smoke document.pdf');
  const secondPDF = join(tempRoot, 'second native smoke document.pdf');
  const missingPDF = join(tempRoot, 'missing native smoke document.pdf');
  const pdfFixture = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n`;
  let recipient;
  let firstMarker;
  let secondMarker;
  let failure;
  const evidence = {
    platform: process.platform,
    helper: helperBinary,
    tempRoot,
    missingPDF,
    firstPDF,
    secondPDF,
  };

  try {
    recipient = await compileRecipient(tempRoot, markerPath);
    evidence.recipient = recipient;
    await writeFile(firstPDF, pdfFixture);
    await writeFile(secondPDF, pdfFixture);

    const missing = await invokeHelper(recipient.appPath, missingPDF);
    evidence.missing = {
      code: missing.code,
      signal: missing.signal,
      stderr: missing.stderr.trim(),
      marker: await readMarker(markerPath),
      runningPIDs: await recipientPIDs(recipient.executablePath),
    };
    assert.notEqual(missing.code, 0, 'missing PDF makes the helper fail');
    assert.match(missing.stderr, /PDF is no longer available/i);
    assert.equal(evidence.missing.marker, null, 'missing PDF does not launch the recipient');
    assert.deepEqual(
      evidence.missing.runningPIDs,
      [],
      'missing PDF does not leave a recipient process',
    );

    const first = await invokeHelper(recipient.appPath, firstPDF);
    evidence.firstHelper = {
      code: first.code,
      signal: first.signal,
      stdout: first.stdout.trim(),
      stderr: first.stderr.trim(),
    };
    assert.equal(first.code, 0, `first helper invocation succeeds: ${first.stderr}`);
    firstMarker = await waitForMarker(
      markerPath,
      (marker) =>
        Array.isArray(marker.received) &&
        marker.received.length === 1 &&
        marker.received[0] === firstPDF &&
        marker.windowTitle === basename(firstPDF) &&
        marker.isActive === true &&
        marker.keyWindow === true &&
        marker.windowVisible === true,
      'first document delivery and foreground state',
    );
    assertNativeForeground(firstMarker, [firstPDF]);
    evidence.firstMarker = firstMarker;

    const firstPID = firstMarker.pid;
    assert.equal(await commandForPID(firstPID), recipient.executablePath);
    const second = await invokeHelper(recipient.appPath, secondPDF);
    evidence.secondHelper = {
      code: second.code,
      signal: second.signal,
      stdout: second.stdout.trim(),
      stderr: second.stderr.trim(),
    };
    assert.equal(second.code, 0, `already-running helper invocation succeeds: ${second.stderr}`);
    secondMarker = await waitForMarker(
      markerPath,
      (marker) =>
        Array.isArray(marker.received) &&
        marker.received.length === 2 &&
        marker.received[0] === firstPDF &&
        marker.received[1] === secondPDF &&
        marker.windowTitle === basename(secondPDF) &&
        marker.pid === firstPID &&
        marker.isActive === true &&
        marker.keyWindow === true &&
        marker.windowVisible === true,
      'already-running second document delivery and foreground state',
    );
    assertNativeForeground(secondMarker, [firstPDF, secondPDF]);
    assert.equal(
      secondMarker.pid,
      firstPID,
      'already-running handoff reuses the recipient process',
    );
    evidence.secondMarker = secondMarker;
    evidence.runningPIDsBeforeCleanup = await recipientPIDs(recipient.executablePath);
  } catch (error) {
    failure = error;
  } finally {
    try {
      if (recipient) {
        const pids = new Set([
          ...(firstMarker?.pid ? [firstMarker.pid] : []),
          ...(secondMarker?.pid ? [secondMarker.pid] : []),
          ...(await recipientPIDs(recipient.executablePath)),
        ]);
        evidence.cleanupPIDs = [...pids];
        for (const pid of pids) await terminateRecipient(pid, recipient.executablePath);
        evidence.runningPIDsAfterCleanup = await recipientPIDs(recipient.executablePath);
        assert.deepEqual(
          evidence.runningPIDsAfterCleanup,
          [],
          'only the generated recipient was cleaned up',
        );
      }
    } catch (error) {
      failure ||= error;
    }
    if (process.env.PDF_HANDOFF_NATIVE_SMOKE_KEEP_TEMP === '1')
      console.error(`PDF_HANDOFF_NATIVE_SMOKE_TEMP ${tempRoot}`);
    else await rm(tempRoot, { recursive: true, force: true });
  }

  if (failure) throw failure;
  console.log('PDF_HANDOFF_NATIVE_SMOKE_PASS', JSON.stringify(evidence));
}

main().catch((error) => {
  console.error(`PDF_HANDOFF_NATIVE_SMOKE_FAIL ${error.stack || error.message}`);
  process.exitCode = 1;
});
