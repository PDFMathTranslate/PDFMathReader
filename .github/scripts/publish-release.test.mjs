import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
test('publication rejects untrusted or failed runs and skips unchanged versions without downloading or publishing', async () => {
  if (process.platform === 'win32') return;
  const dir = await mkdtemp(join(tmpdir(), 'release-gate-'));
  try {
    const fakeGh = join(dir, 'gh');
    await writeFile(
      fakeGh,
      `#!${process.execPath}\nconst args=process.argv.slice(2),repo='owner/repo';
const scenario=process.env.RELEASE_SCENARIO;
let value;
if(args[0]!=='api')throw Error('Unexpected publishing or artifact download');
const path=args.at(-1);
if(path==='repos/'+repo)value={default_branch:'main'};
else if(path.endsWith('/actions/runs/123'))value={status:'completed',conclusion:scenario==='failed'?'failure':'success',path:'.github/workflows/electron-build.yml',name:'Packaging',head_repository:{full_name:scenario==='fork'?'other/repo':repo},head_branch:'main',event:scenario==='pr'?'pull_request':'push',head_sha:'a'.repeat(40)};
else if(path.endsWith('/commits/'+'a'.repeat(40)))value={commit:{message:scenario==='ordinary'?'fix: minor update':'release: 0.1.1'}};
else if(path.includes('/actions/runs?'))value=[{workflow_runs:['Packaging','Code style','Update README recent features'].map((name,id)=>({name,id,event:'push',status:'completed',conclusion:scenario==='other-failed'&&name==='Code style'?'failure':'success'}))}];
else if(path.includes('/contents/package.json'))value={content:Buffer.from(JSON.stringify({version:'0.1.0'})).toString('base64')};
else if(path.includes('/releases?'))value=[[{tag_name:'v0.1.0-beta.3',draft:false}]];
else throw Error('Unexpected API path: '+path);
console.log(JSON.stringify(value));\n`,
      { mode: 0o755 },
    );
    for (const scenario of ['unchanged', 'ordinary', 'other-failed', 'failed', 'fork', 'pr']) {
      const result = spawnSync(process.execPath, ['.github/scripts/publish-release.mjs'], {
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: dir + ':' + process.env.PATH,
          GH_REPO: 'owner/repo',
          SOURCE_RUN_ID: '123',
          RELEASE_SCENARIO: scenario,
          GITHUB_STEP_SUMMARY: '',
        },
      });
      if (['unchanged', 'ordinary'].includes(scenario)) {
        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, /nothing to publish/);
      } else {
        assert.notEqual(result.status, 0);
        assert.match(
          result.stderr,
          /successful default-branch Packaging|All CI workflows must succeed/,
        );
      }
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
