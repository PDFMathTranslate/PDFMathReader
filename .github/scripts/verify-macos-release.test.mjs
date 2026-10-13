import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { UnsignedMacReleaseError, verifyMacReleaseArchive } from './verify-macos-release.mjs';

const publishScript = join(import.meta.dirname, 'publish-release.mjs');

// Build a minimal PDFMathReader.app zip, optionally ad-hoc signed like CI's --unsigned build.
async function macArchive(dir, version, { adHoc }) {
  const app = join(dir, 'build', 'PDFMathReader.app');
  await mkdir(join(app, 'Contents', 'MacOS'), { recursive: true });
  await writeFile(
    join(app, 'Contents', 'Info.plist'),
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>local.previewtranslate.reader</string>
<key>CFBundleExecutable</key><string>PDFMathReader</string>
<key>CFBundleShortVersionString</key><string>${version}</string>
</dict></plist>
`,
  );
  await copyFile('/usr/bin/true', join(app, 'Contents', 'MacOS', 'PDFMathReader'));
  if (adHoc) execFileSync('/usr/bin/codesign', ['--force', '--deep', '-s', '-', app]);
  const archive = join(dir, `PDFMathReader-${adHoc ? 'adhoc' : 'unsigned'}.zip`);
  execFileSync('/usr/bin/ditto', ['-c', '-k', '--keepParent', app, archive]);
  await rm(join(dir, 'build'), { recursive: true, force: true });
  return archive;
}

test('unsigned and ad-hoc signed macOS archives are reported as unsigned releases', async () => {
  if (process.platform !== 'darwin') return;
  const dir = await mkdtemp(join(tmpdir(), 'mac-release-'));
  try {
    for (const adHoc of [false, true]) {
      const archive = await macArchive(dir, '0.1.1', { adHoc });
      assert.throws(() => verifyMacReleaseArchive(archive, '0.1.1'), UnsignedMacReleaseError);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('publication skips with a bun run release hint when CI macOS packages are unsigned', async () => {
  if (process.platform !== 'darwin') return;
  const dir = await mkdtemp(join(tmpdir(), 'mac-release-skip-'));
  try {
    const archive = await macArchive(dir, '0.1.1', { adHoc: true });
    const fakeGh = join(dir, 'gh');
    await writeFile(
      fakeGh,
      `#!${process.execPath}\nconst fs=require('fs'),path=require('path');
const args=process.argv.slice(2),repo='owner/repo',sha='a'.repeat(40);
if(args[0]==='run'&&args[1]==='download'){
  const name=args[args.indexOf('--name')+1],out=args[args.indexOf('--dir')+1];
  if(!name.startsWith('PDFMathReader-darwin'))throw Error('Downloaded past the macOS gate: '+name);
  fs.copyFileSync(${JSON.stringify(archive)},path.join(out,name+'.zip'));process.exit(0);
}
if(args[0]!=='api')throw Error('Unexpected publishing command: '+args.join(' '));
const p=args.at(-1);let value;
if(p==='repos/'+repo)value={default_branch:'main'};
else if(p.endsWith('/actions/runs/123'))value={status:'completed',conclusion:'success',path:'.github/workflows/electron-build.yml',name:'Packaging',head_repository:{full_name:repo},head_branch:'main',event:'push',head_sha:sha};
else if(p.endsWith('/commits/'+sha))value={commit:{message:'release: 0.1.1'}};
else if(p.includes('/actions/runs?'))value=[{workflow_runs:['Packaging','Code style','Update README recent features'].map((name,id)=>({name,id,event:'push',status:'completed',conclusion:'success'}))}];
else if(p.includes('/contents/package.json'))value={content:Buffer.from(JSON.stringify({version:'0.1.1'})).toString('base64')};
else if(p.includes('/releases?'))value=[[{tag_name:'v0.1.0',draft:false}]];
else if(p.includes('/artifacts?'))value=[{artifacts:['darwin-arm64','darwin-x64','win32-x64','win32-ia32','linux-x64','linux-armv7l'].map((t)=>({name:'PDFMathReader-'+t,expired:false,size_in_bytes:1}))}];
else throw Error('Unexpected API path: '+p);
console.log(JSON.stringify(value));\n`,
      { mode: 0o755 },
    );
    const work = join(dir, 'work');
    await mkdir(work);
    const result = spawnSync(process.execPath, [publishScript], {
      cwd: work,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: dir + ':' + process.env.PATH,
        GH_REPO: 'owner/repo',
        SOURCE_RUN_ID: '123',
        GITHUB_STEP_SUMMARY: '',
      },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /::warning::/);
    assert.match(result.stdout, /nothing published/);
    assert.match(result.stdout, /bun run release/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
