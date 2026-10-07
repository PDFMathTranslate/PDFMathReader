import { signMacApplication } from './sign-mac.mjs';
import { distributeApplication } from './distribute.mjs';
import { packager } from '@electron/packager';
import { stageApplication, directoryBytes } from './production-stage.mjs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { writeFile, rm, readFile, mkdir } from 'node:fs/promises';
const test = process.argv.includes('--test');
const unsigned = process.argv.includes('--unsigned');
const platform = process.argv.find((arg) => arg.startsWith('--platform='))?.slice(11) || 'darwin';
const arch =
  process.argv.find((arg) => arg.startsWith('--arch='))?.slice(7) ||
  (platform === 'darwin' ? 'arm64' : 'x64');
if (!['darwin', 'win32', 'linux'].includes(platform))
  throw Error('Unsupported package platform: ' + platform);
const root = process.cwd(),
  packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const electronVersion =
  process.argv.find((arg) => arg.startsWith('--electron-version='))?.slice(19) ||
  (['ia32', 'armv7l'].includes(arch)
    ? '43.4.1'
    : JSON.parse(await readFile(resolve(root, 'node_modules/electron/package.json'), 'utf8'))
        .version);
if (
  (platform === 'linux' && arch === 'ia32') ||
  (['ia32', 'armv7l'].includes(arch) && Number(electronVersion.split('.')[0]) >= 44)
)
  throw Error('Unsupported Electron platform/architecture/version combination.');
const phase = process.argv.find((arg) => arg.startsWith('--stage='))?.slice(8) || 'bundle';
const hapticBinary = resolve(root, '.cache/haptic-feedback'),
  localTranslationBinary = resolve(root, '.cache/local-translation');
await mkdir(resolve(root, '.cache'), { recursive: true });
if (platform === 'darwin') {
  const moduleCache = resolve(root, '.cache/swift-modules');
  execFileSync('/usr/bin/swiftc', [
    '-O',
    '-module-cache-path',
    moduleCache,
    resolve(root, 'electron/platform/macos/haptic-feedback.swift'),
    '-o',
    hapticBinary,
  ]);
  execFileSync('/usr/bin/swiftc', [
    '-O',
    '-parse-as-library',
    '-target',
    `${arch === 'arm64' ? 'arm64' : 'x86_64'}-apple-macosx26.0`,
    '-framework',
    'Translation',
    '-module-cache-path',
    moduleCache,
    resolve(root, 'server/platform/macos/local-translation.swift'),
    '-o',
    localTranslationBinary,
  ]);
}
const { stage } = await stageApplication({ root, phase, test, platform, arch });
const stagedBytes = await directoryBytes(stage);
const paths = await packager({
  dir: stage,
  electronVersion,
  prune: false,
  name: test ? 'PDFMathReader Tests' : 'PDFMathReader',
  appBundleId: test ? 'local.previewtranslate.tests' : 'local.previewtranslate.reader',
  appVersion: packageJson.version,
  win32metadata: { CompanyName: 'PDFMathReader' },
  icon: resolve(
    root,
    platform === 'darwin'
      ? 'electron/AppIcon.icns'
      : platform === 'win32'
        ? 'electron/AppIcon.ico'
        : 'electron/AppIcon.png',
  ),
  extraResource: [
    resolve(root, 'server/kernels/python/kernel-worker.py'),
    resolve(root, 'server/kernels/python/kernel-options.py'),
    resolve(root, 'server/kernels/python/kernel-services.py'),
    ...(platform === 'darwin' ? [localTranslationBinary, hapticBinary] : []),
  ],
  extendInfo: test
    ? {}
    : {
        CFBundleDocumentTypes: [
          {
            CFBundleTypeName: 'PDF Document',
            CFBundleTypeRole: 'Viewer',
            LSHandlerRank: 'Alternate',
            LSItemContentTypes: ['com.adobe.pdf'],
            CFBundleTypeExtensions: ['pdf'],
          },
        ],
      },
  platform,
  arch,
  out: test ? '/tmp/pdfmathreader-slim-test-build' : resolve(root, 'release'),
  overwrite: true,
  asar: { unpack: '**/*.node' },
  ignore: [
    /^\/release(?:\/|$)/,
    /^\/\.cache(?:\/|$)/,
    /^\/\.env(?:\.|$)/,
    /^\/src(?:\/|$)/,
    /^\/public(?:\/|$)/,
    /^\/preview\.png$/,
    /^\/.*\.test\.mjs$/,
  ],
});
if (!test && !unsigned && platform === 'darwin')
  for (const path of paths) await signMacApplication(resolve(path, 'PDFMathReader.app'), root);
for (const path of paths)
  await writeFile(
    resolve(path, 'package-size.json'),
    JSON.stringify(
      {
        phase,
        test,
        stagedBytes,
        appBytes: await directoryBytes(
          platform === 'darwin'
            ? resolve(path, (test ? 'PDFMathReader Tests' : 'PDFMathReader') + '.app')
            : path,
        ),
      },
      null,
      2,
    ),
  );
await rm(stage, { recursive: true, force: true });
if (!test && process.argv.includes('--distribute'))
  for (const path of paths) await distributeApplication({ path, platform, arch, electronVersion });
console.log(paths.join('\n'));
