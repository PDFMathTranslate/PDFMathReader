const {test}=require('node:test');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {mkdtempSync,writeFileSync,readFileSync,rmSync}=require('node:fs');
const {join}=require('node:path');
const {tmpdir}=require('node:os');
const update=require('./recent-updates.cjs');

test('multi-commit pushes update only English README, keep seven dated features and remain idempotent',async()=>{
 const root=mkdtempSync(join(tmpdir(),'reader-recent-updates-')),previous=process.cwd();
 const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 try{
  git('init');git('config','user.name','Contributor');git('config','user.email','contributor@example.com');
  const original='Intro\n\n## Features\n\nKeep features\n\n## Recent updates\n\nOld table\n\n## Quick start\n\nKeep quick start\n';
  writeFileSync(join(root,'README.md'),original);writeFileSync(join(root,'translated.md'),'Keep translation');
  git('add','.');git('commit','-m','initial');const before=git('rev-parse','HEAD');
  for(let n=1;n<=9;n++){
   writeFileSync(join(root,'app.js'),`// feature ${n}\n`);git('add','app.js');git('commit','-m',`feat(reader): feature ${n}`);
  }
  const newest=git('rev-parse','HEAD');
  writeFileSync(join(root,'README.md'),original+'\nBadge\n');git('add','README.md');git('commit','-m','feat: ci badge');
  writeFileSync(join(root,'app.js'),'// fix\n');git('add','app.js');git('commit','-m','fix: last commit');const after=git('rev-parse','HEAD');
  let calls=0;const outputs=[];
  const github={rest:{repos:{getCommit:async({ref})=>{calls++;return {data:{author:{login:'contributor',html_url:'https://github.com/contributor'},html_url:`https://github.com/owner/repo/commit/${ref}`}};}}}};
  const core={info:()=>{},setOutput:(...args)=>outputs.push(args)};
  const context={repo:{owner:'owner',repo:'repo'},payload:{before,after}};
  process.chdir(root);
  await update({github,context,core});
  const result=readFileSync('README.md','utf8');
  assert.equal(calls,7);assert.equal((result.match(/^\| \d{4}-\d{2}-\d{2} \|/gm)||[]).length,7);
  assert.ok(result.includes(`[feature 9](https://github.com/owner/repo/commit/${newest})`));
  assert.ok(!result.includes('ci badge'));assert.ok(!result.includes('feature 2]'));
  assert.ok(result.includes('Keep features'));assert.ok(result.includes('Keep quick start\n\nBadge'));
  assert.ok(result.includes('[@contributor](https://github.com/contributor)'));
  assert.equal(readFileSync('translated.md','utf8'),'Keep translation');
  assert.deepEqual(outputs,[['changed','true']]);
  outputs.length=0;await update({github,context,core});assert.deepEqual(outputs,[]);
  // A fix-only push performs no API calls or file writes.
  const callCount=calls;
  context.payload.before=git('rev-parse','HEAD^');await update({github,context,core});
  assert.equal(calls,callCount);assert.equal(readFileSync('README.md','utf8'),result);
  // New branches have an all-zero before SHA.
  context.payload={before:'0'.repeat(40),after,created:true};
  await update({github,context,core});assert.equal(readFileSync('README.md','utf8'),result);
 }finally{process.chdir(previous);rmSync(root,{recursive:true,force:true});}
});
