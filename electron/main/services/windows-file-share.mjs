import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import pathModule from 'node:path';

const SHARE_START_TIMEOUT_MS = 30_000;
const SHARE_PROCESS_TIMEOUT_MS = 150_000;
const MAX_OUTPUT_BYTES = 64 * 1024;

const activeShares = new WeakMap();

const POWERSHELL_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'

try {
    Add-Type -AssemblyName System.Runtime.WindowsRuntime
    Add-Type -AssemblyName System.Windows.Forms

    $winMetadata = Join-Path $env:windir 'System32\WinMetadata'
    $runtimeAssembly = [System.Runtime.InteropServices.WindowsRuntime.WindowsRuntimeMarshal].Assembly.Location
    $formsAssembly = [System.Windows.Forms.Application].Assembly.Location
    $references = @(
        $runtimeAssembly,
        $formsAssembly,
        (Join-Path $winMetadata 'Windows.Foundation.winmd'),
        (Join-Path $winMetadata 'Windows.ApplicationModel.DataTransfer.winmd'),
        (Join-Path $winMetadata 'Windows.Storage.winmd')
    )

    $source = @'
using System;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.WindowsRuntime;
using System.Reflection;
using System.Threading;
using Windows.ApplicationModel.DataTransfer;
using Windows.Foundation;
using Windows.Storage;
using System.Windows.Forms;

namespace PdfMathReader.Windows
{
    public static class ShareBridge
    {
        private const int WaitMilliseconds = 120000;
        private static readonly Guid DataTransferManagerIid = new Guid(
            "A5CAEE9B-8708-49D1-8D36-67D25A8DA00C");

        public static int Run(string hwndText, string filePath)
        {
            IntPtr hwnd = ParseWindowHandle(hwndText);
            StorageFile file = StorageFile.GetFileFromPathAsync(filePath)
                .AsTask()
                .GetAwaiter()
                .GetResult();
            DataTransferManager manager = GetDataTransferManager(hwnd);
            ManualResetEventSlim finished = new ManualResetEventSlim(false);
            int result = 2;
            string requestError = null;
            DataPackage package = null;
            EventInfo shareCanceledEvent = null;
            Delegate shareCanceledHandler = null;

            TypedEventHandler<DataPackage, ShareCompletedEventArgs> shareCompleted =
                (sender, args) =>
                {
                    result = 0;
                    finished.Set();
                };

            TypedEventHandler<DataTransferManager, DataRequestedEventArgs> dataRequested =
                (sender, args) =>
                {
                    try
                    {
                        package = args.Request.Data;
                        package.Properties.Title = "PDFMathReader";
                        package.RequestedOperation = DataPackageOperation.Copy;
                        package.SetStorageItems(new IStorageItem[] { file });
                        package.ShareCompleted += shareCompleted;
                        AttachShareCanceled(package, () =>
                        {
                            result = 1;
                            finished.Set();
                        }, out shareCanceledEvent, out shareCanceledHandler);
                    }
                    catch (Exception error)
                    {
                        requestError = error.GetType().Name + ": " + error.Message;
                        result = 2;
                        finished.Set();
                    }
                };

            manager.DataRequested += dataRequested;

            try
            {
                DataTransferManagerInterop interop =
                    (DataTransferManagerInterop)WindowsRuntimeMarshal.GetActivationFactory(
                        typeof(DataTransferManager));

                interop.ShowShareUIForWindow(hwnd);
                Console.WriteLine("READY");
                Console.Out.Flush();

                DateTime deadline = DateTime.UtcNow.AddMilliseconds(WaitMilliseconds);
                while (!finished.IsSet && DateTime.UtcNow < deadline)
                {
                    Application.DoEvents();
                    finished.Wait(50);
                }

                if (!finished.IsSet)
                {
                    result = 2;
                }

                if (requestError != null)
                {
                    WriteError("DataRequested", requestError);
                    return 1;
                }

                Console.WriteLine(result == 0 ? "RESULT\tsuccess" : "RESULT\tcancelled");
                Console.Out.Flush();
                return result == 0 ? 0 : 2;
            }
            catch (Exception error)
            {
                WriteError(error.GetType().Name, error.Message);
                return 1;
            }
            finally
            {
                manager.DataRequested -= dataRequested;
                if (package != null)
                {
                    try
                    {
                        package.ShareCompleted -= shareCompleted;
                    }
                    catch
                    {
                    }

                    if (shareCanceledEvent != null && shareCanceledHandler != null)
                    {
                        try
                        {
                            shareCanceledEvent.RemoveEventHandler(package, shareCanceledHandler);
                        }
                        catch
                        {
                        }
                    }
                }

                finished.Dispose();
            }
        }

        private static DataTransferManager GetDataTransferManager(IntPtr hwnd)
        {
            DataTransferManagerInterop interop =
                (DataTransferManagerInterop)WindowsRuntimeMarshal.GetActivationFactory(
                    typeof(DataTransferManager));
            Guid iid = DataTransferManagerIid;
            return interop.GetForWindow(hwnd, ref iid);
        }

        private static void AttachShareCanceled(
            DataPackage package,
            Action callback,
            out EventInfo eventInfo,
            out Delegate handler)
        {
            eventInfo = null;
            handler = null;
            try
            {
                eventInfo = typeof(DataPackage).GetEvent("ShareCanceled");
                if (eventInfo == null || eventInfo.EventHandlerType == null)
                {
                    return;
                }

                ShareCanceledSink sink = new ShareCanceledSink(callback);
                handler = Delegate.CreateDelegate(eventInfo.EventHandlerType, sink, "Invoke");
                eventInfo.AddEventHandler(package, handler);
            }
            catch
            {
                eventInfo = null;
                handler = null;
            }
        }

        private sealed class ShareCanceledSink
        {
            private readonly Action callback;

            public ShareCanceledSink(Action callback)
            {
                this.callback = callback;
            }

            public void Invoke(DataPackage sender, object args)
            {
                callback();
            }
        }

        private static IntPtr ParseWindowHandle(string text)
        {
            ulong value = UInt64.Parse(text, NumberStyles.None, CultureInfo.InvariantCulture);

            if (IntPtr.Size == 4)
            {
                if (value > UInt32.MaxValue)
                {
                    throw new ArgumentOutOfRangeException("text", "The HWND does not fit in a 32-bit pointer.");
                }

                return new IntPtr(unchecked((int)(UInt32)value));
            }

            return new IntPtr(unchecked((long)value));
        }

        private static void WriteError(string kind, string message)
        {
            string safeKind = (kind ?? "Error").Replace('\t', ' ').Replace('\r', ' ').Replace('\n', ' ');
            string safeMessage = (message ?? "Unknown Windows sharing error")
                .Replace('\t', ' ')
                .Replace('\r', ' ')
                .Replace('\n', ' ');
            Console.Error.WriteLine("ERROR\t" + safeKind + "\t" + safeMessage);
            Console.Error.Flush();
        }

        [ComImport]
        [Guid("3A3DCD6C-3EAB-43DC-BCDE-45671CE800C8")]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface DataTransferManagerInterop
        {
            DataTransferManager GetForWindow([In] IntPtr appWindow, [In] ref Guid riid);
            void ShowShareUIForWindow([In] IntPtr appWindow);
        }
    }
}
'@

    Add-Type -TypeDefinition $source -Language CSharp -ReferencedAssemblies $references | Out-Null
    $result = [PdfMathReader.Windows.ShareBridge]::Run(
        $env:PDFMATHREADER_SHARE_HWND,
        $env:PDFMATHREADER_SHARE_PATH)
    exit ([int]$result)
}
catch {
    $message = $_.Exception.ToString().Replace([char]9, ' ').Replace([char]13, ' ').Replace([char]10, ' ')
    [Console]::Error.WriteLine(('ERROR' + [char]9 + 'PowerShell' + [char]9 + $message))
    [Console]::Error.Flush()
    exit 1
}
`;

function makeShareError(code, message, cause) {
  const error = new Error(message, { cause });
  error.code = code;
  return error;
}

function getWindowHandle(target) {
  if (!target || typeof target.getNativeWindowHandle !== 'function') {
    throw makeShareError(
      'ERR_SHARE_TARGET',
      'Windows file sharing requires an Electron BrowserWindow target.',
    );
  }

  if (typeof target.isDestroyed === 'function' && target.isDestroyed()) {
    throw makeShareError('ERR_SHARE_CANCELLED', 'The target window is already destroyed.');
  }

  let nativeHandle;
  try {
    nativeHandle = target.getNativeWindowHandle();
  } catch (error) {
    throw makeShareError('ERR_SHARE_TARGET', 'Could not read the target window handle.', error);
  }

  if (!Buffer.isBuffer(nativeHandle) && !(nativeHandle instanceof Uint8Array)) {
    throw makeShareError('ERR_SHARE_TARGET', 'Electron returned an invalid native window handle.');
  }

  const bytes = Buffer.from(nativeHandle);
  if (bytes.length !== 4 && bytes.length !== 8) {
    throw makeShareError(
      'ERR_SHARE_TARGET',
      `Electron returned a ${bytes.length}-byte native window handle; expected 4 or 8 bytes.`,
    );
  }

  const value = bytes.length === 4 ? BigInt(bytes.readUInt32LE(0)) : bytes.readBigUInt64LE(0);
  if (value === 0n) {
    throw makeShareError('ERR_SHARE_TARGET', 'Electron returned a null native window handle.');
  }

  return value.toString(10);
}

async function getSharePath(filePath) {
  if (typeof filePath !== 'string' || filePath.length === 0 || filePath.includes('\0')) {
    throw makeShareError('ERR_SHARE_PATH', 'Windows file sharing requires a non-empty file path.');
  }

  const windowsPath = filePath.replaceAll('/', '\\');
  if (!pathModule.win32.isAbsolute(windowsPath)) {
    throw makeShareError('ERR_SHARE_PATH', 'Windows file sharing requires an absolute file path.');
  }

  let fileInfo;
  try {
    fileInfo = await stat(windowsPath);
  } catch (error) {
    throw makeShareError('ERR_SHARE_PATH', 'The file to share could not be read.', error);
  }

  if (!fileInfo.isFile()) {
    throw makeShareError('ERR_SHARE_PATH', 'The path to share is not a regular file.');
  }

  return windowsPath;
}

function encodePowerShellScript(script) {
  return Buffer.from(script, 'utf16le').toString('base64');
}

function appendOutput(buffer, chunk) {
  const next = `${buffer}${chunk.toString('utf8')}`;
  return next.length > MAX_OUTPUT_BYTES ? next.slice(-MAX_OUTPUT_BYTES) : next;
}

function terminateChild(child) {
  if (child.exitCode !== null || child.signalCode !== null || child.killed) {
    return;
  }

  try {
    child.kill();
  } catch {
    // The child may have exited between the state check and kill().
  }
}

function cancelActiveShare(target) {
  const current = activeShares.get(target);
  if (!current) {
    return;
  }

  current.cancel();
}

function startShare(target, windowsPath, hwndText) {
  const encodedScript = encodePowerShellScript(POWERSHELL_SCRIPT);
  const environment = {
    ...process.env,
    PDFMATHREADER_SHARE_PATH: windowsPath,
    PDFMATHREADER_SHARE_HWND: hwndText,
  };

  const child = spawn(
    'powershell.exe',
    [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-STA',
      '-EncodedCommand',
      encodedScript,
    ],
    {
      env: environment,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
  );

  let stdout = '';
  let stderr = '';
  let ready = false;
  let settled = false;
  let startTimer;
  let processTimer;
  let onWindowClosed;
  let cancelShare;

  const promise = new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(startTimer);
      clearTimeout(processTimer);
      if (onWindowClosed && typeof target.removeListener === 'function') {
        target.removeListener('closed', onWindowClosed);
      }
      if (activeShares.get(target)?.child === child) {
        activeShares.delete(target);
      }
    };

    const finish = (error, value) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      if (error) {
        reject(error);
      } else {
        resolve(value);
      }
    };

    cancelShare = () => {
      terminateChild(child);
      finish(undefined, false);
    };

    const processError = (message, cause) => {
      finish(makeShareError('ERR_SHARE_PROCESS', message, cause));
    };

    const processLine = (line) => {
      if (line === 'READY') {
        ready = true;
        clearTimeout(startTimer);
        return;
      }

      if (line.startsWith('ERROR\t')) {
        const [, kind = 'WindowsError', ...parts] = line.split('\t');
        processError(`Windows sharing failed (${kind}): ${parts.join('\t') || 'unknown error'}`);
        return;
      }

      if (line === 'RESULT\tcancelled' && !ready) {
        processError('Windows sharing was cancelled before the share UI became ready.');
      }
    };

    const consumeLines = (chunk) => {
      const lines = chunk.split(/\r?\n/);
      const remainder = lines.pop();
      for (const line of lines) {
        processLine(line.trim());
      }
      return remainder;
    };

    let stdoutRemainder = '';
    child.stdout.on('data', (chunk) => {
      stdout = appendOutput(stdout, chunk);
      stdoutRemainder = consumeLines(`${stdoutRemainder}${chunk.toString('utf8')}`);
    });

    child.stderr.on('data', (chunk) => {
      stderr = appendOutput(stderr, chunk);
    });

    child.once('error', (error) => {
      processError('The PowerShell sharing process could not be started.', error);
    });

    child.once('close', (code, signal) => {
      if (ready && (code === 0 || code === 2)) {
        finish(undefined, code === 0);
        return;
      }

      const details = stderr.trim() || stdout.trim();
      const suffix = details ? `: ${details}` : '';
      processError(
        `The PowerShell sharing process exited before the share UI became ready (code ${code ?? 'unknown'}, signal ${signal ?? 'none'})${suffix}`,
      );
    });

    onWindowClosed = () => {
      terminateChild(child);
      finish(undefined, false);
    };
    if (typeof target.once === 'function') {
      target.once('closed', onWindowClosed);
    }

    startTimer = setTimeout(() => {
      const error = makeShareError(
        'ERR_SHARE_TIMEOUT',
        'Windows sharing did not open within 30 seconds.',
      );
      terminateChild(child);
      finish(error);
    }, SHARE_START_TIMEOUT_MS);

    processTimer = setTimeout(() => {
      terminateChild(child);
      if (!ready) {
        finish(makeShareError('ERR_SHARE_TIMEOUT', 'Windows sharing timed out before completion.'));
      } else {
        finish(undefined, false);
      }
    }, SHARE_PROCESS_TIMEOUT_MS);
  });

  activeShares.set(target, {
    child,
    cancel: cancelShare,
  });

  return promise;
}

/**
 * Shows the Windows native sharing UI for a PDF owned by the target window.
 * Keeps the helper alive while the native UI handles the share. Returns true
 * on completion and false on cancellation or an unsupported platform.
 */
export async function shareWindowsFile(target, filePath) {
  if (process.platform !== 'win32') {
    return false;
  }

  const hwndText = getWindowHandle(target);
  const windowsPath = await getSharePath(filePath);
  cancelActiveShare(target);
  return startShare(target, windowsPath, hwndText);
}
