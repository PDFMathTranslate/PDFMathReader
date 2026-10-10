import { execFile, spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const MAX_COMMAND_OUTPUT = 4 * 1024 * 1024;
const COMMAND_TIMEOUT = 10000;

const MACOS_APPLICATIONS_SCRIPT = String.raw`
ObjC.import('AppKit');
ObjC.import('Foundation');

function unwrap(value) {
  try { return ObjC.unwrap(value); } catch { return ''; }
}

function run(args) {
  const path = String(args[0] || '');
  const fileURL = $.NSURL.fileURLWithPath($(path));
  const workspace = $.NSWorkspace.sharedWorkspace;
  const applications = workspace.URLsForApplicationsToOpenURL(fileURL);
  const fileManager = $.NSFileManager.defaultManager;
  const result = [];
  for (let index = 0; index < applications.count; index += 1) {
    const applicationURL = applications.objectAtIndex(index);
    const id = String(unwrap(applicationURL.path) || '');
    const name = String(unwrap(fileManager.displayNameAtPath(applicationURL.path)) || '');
    if (id && name) result.push({ id, name });
  }
  return JSON.stringify(result);
}
`;

const WINDOWS_REGISTRY_SCRIPT = String.raw`
$ErrorActionPreference = 'SilentlyContinue'
$seen = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
$ids = [System.Collections.Generic.List[string]]::new()
$hints = @{}

function Add-Id([object] $value, [object] $hint) {
  $id = [string]$value
  if ([string]::IsNullOrWhiteSpace($id) -or $id.Length -gt 256) { return }
  $id = $id.Trim()
  if ($seen.Add($id)) { [void]$ids.Add($id) }
  if (-not [string]::IsNullOrWhiteSpace([string]$hint)) { $hints[$id] = ([string]$hint).Trim() }
}

function Read-Value([string] $path, [string] $name) {
  try {
    $item = Get-ItemProperty -LiteralPath $path -ErrorAction Stop
    $property = $item.PSObject.Properties[$name]
    if ($property) { return [string]$property.Value }
  } catch {}
  return ''
}

$openWithPaths = @(
  'HKCU:\Software\Classes\.pdf\OpenWithProgids',
  'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.pdf\OpenWithProgids',
  'HKLM:\Software\Classes\.pdf\OpenWithProgids',
  'HKLM:\Software\Classes\Wow6432Node\.pdf\OpenWithProgids'
)
foreach ($path in $openWithPaths) {
  try {
    $item = Get-ItemProperty -LiteralPath $path -ErrorAction Stop
    foreach ($property in $item.PSObject.Properties) {
      if ($property.Name -notmatch '^PS') { Add-Id $property.Name '' }
    }
  } catch {}
}

$registeredPaths = @(
  'HKCU:\Software\RegisteredApplications',
  'HKLM:\Software\RegisteredApplications',
  'HKLM:\Software\Wow6432Node\RegisteredApplications'
)
$capabilityRoots = @('HKCU:\Software', 'HKLM:\Software', 'HKLM:\Software\Wow6432Node')
foreach ($path in $registeredPaths) {
  try {
    $item = Get-ItemProperty -LiteralPath $path -ErrorAction Stop
    foreach ($property in $item.PSObject.Properties) {
      if ($property.Name -match '^PS') { continue }
      $relative = [string]$property.Value
      $relative = $relative -replace '(?i)^(HKEY_LOCAL_MACHINE|HKEY_CURRENT_USER|HKLM|HKCU):?\\', ''
      $relative = $relative -replace '(?i)^SOFTWARE\\', ''
      foreach ($root in $capabilityRoots) {
        try {
          $capability = Join-Path $root $relative
          $name = Read-Value $capability 'ApplicationName'
          $association = Get-ItemProperty -LiteralPath (Join-Path $capability 'FileAssociations') -ErrorAction Stop
          $pdf = $association.PSObject.Properties['.pdf']
          if ($pdf) { Add-Id $pdf.Value $name }
        } catch {}
      }
    }
  } catch {}
}

$classRoots = @('HKCU:\Software\Classes', 'HKLM:\Software\Classes', 'HKLM:\Software\Classes\Wow6432Node')
$result = foreach ($id in $ids) {
  foreach ($root in $classRoots) {
    try {
      $classPath = Join-Path $root $id
      $command = Read-Value (Join-Path $classPath 'shell\open\command') '(default)'
      if ([string]::IsNullOrWhiteSpace($command)) { continue }
      $name = Read-Value $classPath 'FriendlyAppName'
      if ([string]::IsNullOrWhiteSpace($name)) { $name = Read-Value $classPath '(default)' }
      if ([string]::IsNullOrWhiteSpace($name)) { $name = $hints[$id] }
      if ([string]::IsNullOrWhiteSpace($name)) { $name = $id }
      [pscustomobject]@{ id = $id; name = $name; command = $command }
      break
    } catch {}
  }
}
@($result) | ConvertTo-Json -Compress -Depth 4
`;

function outputText(result) {
  const value = result && typeof result === 'object' && 'stdout' in result ? result.stdout : result;
  return Buffer.isBuffer(value) ? value.toString('utf8') : value == null ? '' : String(value);
}

function parseJSON(value) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
  } catch {
    return [];
  }
}

function safeCall(callback, fallback = '') {
  try {
    const value = callback?.();
    return typeof value === 'string' ? value : fallback;
  } catch {
    return fallback;
  }
}

function applicationBundlePath(executable) {
  const match = /^(.*?\.app)(?:[\\/]|$)/i.exec(executable || '');
  return match?.[1] || '';
}

function samePath(left, right) {
  const normalize = (value) =>
    String(value || '')
      .replaceAll('\\', '/')
      .replace(/\/+$/, '');
  return normalize(left).toLowerCase() === normalize(right).toLowerCase();
}

function ownApplication(app) {
  const name = safeCall(() => app?.getName?.(), app?.name || '');
  const executable = safeCall(() => app?.getPath?.('exe'));
  return {
    name: name.trim(),
    bundle: applicationBundlePath(executable),
  };
}

function looksLikeReaderName(value, ownName) {
  const name = basename(String(value || ''))
    .replace(/\.app$/i, '')
    .replace(/\.exe$/i, '')
    .trim();
  if (!name) return false;
  const names = [ownName, 'PDFMathReader'].filter(Boolean).map((entry) => entry.toLowerCase());
  const lower = name.toLowerCase();
  return names.some((entry) => lower === entry || lower.startsWith(`${entry} `));
}

function isOwnApplication(candidate, identity) {
  if (identity.bundle && samePath(candidate.id, identity.bundle)) return true;
  return [candidate.id, candidate.name, candidate.command, candidate.desktopFile].some((value) =>
    looksLikeReaderName(value, identity.name),
  );
}

function validPDFPath(path) {
  if (typeof path !== 'string' || !path.trim()) throw Error('A PDF path is required.');
  return path;
}

function candidateKey(id, platform) {
  return platform === 'win32' ? String(id).toLowerCase() : String(id);
}

function desktopDirectories(environment, override) {
  if (Array.isArray(override) && override.length) return override;
  const userData = environment.XDG_DATA_HOME || join(homedir(), '.local', 'share');
  const systemData = (environment.XDG_DATA_DIRS || '/usr/local/share:/usr/share')
    .split(':')
    .filter(Boolean);
  return [...new Set([userData, ...systemData].map((root) => join(root, 'applications')))];
}

function parseDesktopEntry(source, environment) {
  const fields = new Map();
  let active = false;
  for (const line of String(source).split(/\r?\n/)) {
    if (line === '[Desktop Entry]') {
      active = true;
      continue;
    }
    if (line.startsWith('[')) {
      active = false;
      continue;
    }
    if (!active || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator > 0) fields.set(line.slice(0, separator), line.slice(separator + 1));
  }
  const locale = String(environment.LC_MESSAGES || environment.LC_ALL || environment.LANG || '')
    .split('.')[0]
    .replace('-', '_');
  const language = locale.split('_')[0];
  const name =
    fields.get(`Name[${locale}]`) || fields.get(`Name[${language}]`) || fields.get('Name');
  return {
    type: fields.get('Type') || 'Application',
    hidden: fields.get('Hidden') === 'true',
    name: name?.trim(),
    exec: fields.get('Exec')?.trim(),
  };
}

function tokenizeDesktopExec(command) {
  const tokens = [];
  let token = '';
  let quoted = false;
  let escaped = false;
  for (const character of String(command || '')) {
    if (escaped) {
      token += character;
      escaped = false;
    } else if (character === '\\') escaped = true;
    else if (character === '"') quoted = !quoted;
    else if (/\s/.test(character) && !quoted) {
      if (token) tokens.push(token);
      token = '';
    } else token += character;
  }
  if (escaped) token += '\\';
  if (quoted) return [];
  if (token) tokens.push(token);
  return tokens;
}

function desktopArguments(entry, path) {
  const tokens = tokenizeDesktopExec(entry.exec);
  if (!tokens.length) return null;
  const executable = tokens.shift();
  let hasFile = false;
  const uri = pathToFileURL(path).href;
  const args = [];
  for (const token of tokens) {
    if (token === '%i') continue;
    if (/%[A-Za-z]/.test(token) && !/%(?:[fFuUick])/.test(token)) return null;
    const substituted = token.replace(/%([fFuUick%])/g, (_, code) => {
      if (code === 'f' || code === 'F') {
        hasFile = true;
        return path;
      }
      if (code === 'u' || code === 'U') {
        hasFile = true;
        return uri;
      }
      if (code === 'c') return entry.name;
      if (code === 'k') return entry.desktopFile;
      if (code === 'i') return '';
      return '%';
    });
    if (substituted) args.push(substituted);
  }
  if (!hasFile) args.push(path);
  return { executable, args };
}

function expandWindowsVariables(value, environment) {
  return String(value || '').replace(/%([A-Za-z_][A-Za-z0-9_().-]*)%/g, (whole, name) => {
    const replacement = environment[name];
    return replacement === undefined ? whole : replacement;
  });
}

function tokenizeWindowsCommand(command) {
  const tokens = [];
  let token = '';
  let quoted = false;
  let slashes = 0;
  const pushSlashes = (count) => {
    token += '\\'.repeat(count);
  };
  for (const character of String(command || '')) {
    if (character === '\\') {
      slashes += 1;
      continue;
    }
    if (character === '"') {
      pushSlashes(Math.floor(slashes / 2));
      if (slashes % 2) token += '"';
      else quoted = !quoted;
      slashes = 0;
      continue;
    }
    pushSlashes(slashes);
    slashes = 0;
    if (/\s/.test(character) && !quoted) {
      if (token) tokens.push(token);
      token = '';
    } else token += character;
  }
  pushSlashes(slashes);
  if (token) tokens.push(token);
  return tokens;
}

function windowsArguments(command, path, environment) {
  const tokens = tokenizeWindowsCommand(expandWindowsVariables(command, environment));
  if (!tokens.length) return null;
  const executable = tokens.shift();
  let hasFile = false;
  const args = tokens.map((token) =>
    token.replace(/%(?:1|L|l|f|F|u|U|\*)/g, () => {
      hasFile = true;
      return path;
    }),
  );
  if (!hasFile) args.push(path);
  return { executable, args };
}

function spawnApplication(spawnImpl, executable, args) {
  const child = spawnImpl(executable, args, {
    detached: true,
    shell: false,
    stdio: 'ignore',
    windowsHide: true,
  });
  if (!child || typeof child.once !== 'function') {
    child?.unref?.();
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref?.();
      resolve();
    });
  });
}

export function createPDFApplicationService({
  platform = process.platform,
  app,
  execFileImpl = execFileAsync,
  spawnImpl = spawn,
  readFileImpl = readFile,
  environment = process.env,
  linuxApplicationDirectories,
} = {}) {
  const identity = ownApplication(app);
  const known = new Map();

  async function run(command, args) {
    return execFileImpl(command, args, {
      encoding: 'utf8',
      maxBuffer: MAX_COMMAND_OUTPUT,
      timeout: COMMAND_TIMEOUT,
      windowsHide: true,
    });
  }

  function remember(entries) {
    // Menus cache choices per document. A query in another window must not
    // invalidate a previously discovered application that is still in a menu.
    const result = [];
    const seen = new Set();
    for (const entry of entries) {
      if (!entry?.id || !entry?.name || isOwnApplication(entry, identity)) continue;
      const key = candidateKey(entry.id, platform);
      if (seen.has(key)) continue;
      seen.add(key);
      known.set(key, entry);
      result.push({ id: entry.id, name: entry.name });
    }
    return result;
  }

  async function listMac(path) {
    try {
      const result = await run('/usr/bin/osascript', [
        '-l',
        'JavaScript',
        '-e',
        MACOS_APPLICATIONS_SCRIPT,
        '--',
        path,
      ]);
      return parseJSON(outputText(result))
        .map((entry) => ({
          id: typeof entry?.id === 'string' ? entry.id.trim() : '',
          name: typeof entry?.name === 'string' ? entry.name.trim() : '',
          source: 'macos',
        }))
        .filter((entry) => entry.id && entry.name);
    } catch {
      return [];
    }
  }

  async function listLinux() {
    let output;
    try {
      output = outputText(await run('gio', ['mime', 'application/pdf']));
    } catch {
      return [];
    }
    const ids = [];
    for (const match of output.matchAll(/([^\s"'<>]+\.desktop)\b/g)) {
      const id = match[1];
      if (!id.startsWith('.') && !id.includes('/') && !ids.includes(id)) ids.push(id);
    }
    const entries = [];
    for (const id of ids) {
      for (const directory of desktopDirectories(environment, linuxApplicationDirectories)) {
        const desktopFile = join(directory, id);
        try {
          const source = await readFileImpl(desktopFile, 'utf8');
          const parsed = parseDesktopEntry(source, environment);
          if (parsed.type === 'Application' && !parsed.hidden && parsed.name && parsed.exec) {
            entries.push({
              id,
              name: parsed.name,
              exec: parsed.exec,
              desktopFile,
              source: 'linux',
            });
            break;
          }
        } catch {}
      }
    }
    return entries;
  }

  async function listWindows() {
    try {
      const encoded = Buffer.from(WINDOWS_REGISTRY_SCRIPT, 'utf16le').toString('base64');
      const result = await run('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-EncodedCommand',
        encoded,
      ]);
      return parseJSON(outputText(result))
        .map((entry) => ({
          id: typeof entry?.id === 'string' ? entry.id.trim() : '',
          name: typeof entry?.name === 'string' ? entry.name.trim() : '',
          command: typeof entry?.command === 'string' ? entry.command.trim() : '',
          source: 'windows',
        }))
        .filter((entry) => entry.id && entry.name && entry.command);
    } catch {
      return [];
    }
  }

  async function list(path) {
    const pdfPath = validPDFPath(path);
    if (platform === 'darwin') return remember(await listMac(pdfPath));
    if (platform === 'linux') return remember(await listLinux());
    if (platform === 'win32') return remember(await listWindows());
    known.clear();
    return [];
  }

  async function open(candidate, path) {
    const pdfPath = validPDFPath(path);
    const id = typeof candidate === 'string' ? candidate : candidate?.id;
    const entry = id ? known.get(candidateKey(id, platform)) : null;
    if (!entry) {
      const error = Error('Unknown PDF application. Refresh the application list and try again.');
      error.code = 'UNKNOWN_PDF_APPLICATION';
      throw error;
    }
    if (platform === 'darwin') {
      await run('/usr/bin/open', ['-a', entry.id, pdfPath]);
      return true;
    }
    if (platform === 'linux') {
      const command = desktopArguments(entry, pdfPath);
      if (!command) throw Error('The selected PDF application has an invalid launch command.');
      await spawnApplication(spawnImpl, command.executable, command.args);
      return true;
    }
    if (platform === 'win32') {
      const command = windowsArguments(entry.command, pdfPath, environment);
      if (!command) throw Error('The selected PDF application has an invalid launch command.');
      await spawnApplication(spawnImpl, command.executable, command.args);
      return true;
    }
    throw Error(`Opening PDFs is unsupported on ${platform}.`);
  }

  return { list, open };
}
