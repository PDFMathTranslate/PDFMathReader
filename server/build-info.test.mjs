import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readBuildInfo} from '../scripts/build-info.mjs';

function temporaryRoot(){return mkdtempSync(join(tmpdir(),'pdf-math-reader-build-info-'));}
function git(root,...args){return execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
function commit(root,subject,number){
 writeFileSync(join(root,'history.txt'),`${number}\n`,{flag:'a'});
 git(root,'add','history.txt');
 git(root,'commit','-qm',subject);
 return git(root,'rev-parse','HEAD');
}

test('reads the latest ten feature commits from a real Git history',()=>{
 const root=temporaryRoot();
 try{
  writeFileSync(join(root,'package.json'),JSON.stringify({version:'9.8.7'}));
  git(root,'init','-q');
  git(root,'config','user.name','Build Info Test');
  git(root,'config','user.email','build-info@example.test');
  git(root,'add','package.json');
  git(root,'commit','-qm','chore: initialize test repository');
  const features=[];
  for(let number=1;number<=14;number++){
   const subject=number===5?`feat(reader)!: breaking feature ${number}`:number===2?`feat(reader): scoped feature ${number}`:`feat: feature ${number}`;
   const hash=commit(root,subject,number);
   features.push({hash,date:git(root,'show','-s','--format=%cI',hash),subject:subject.replace(/^feat(?:\([^\r\n)]+\))?!?:\s*/,'')});
   if(number%2===0)commit(root,`fix: interleaved fix ${number}`,`fix-${number}`);
  }
  const info=readBuildInfo(root);
  assert.equal(info.version,'9.8.7');
  assert.equal(info.revision,git(root,'rev-parse','HEAD'));
  assert.match(info.builtAt,/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.deepEqual(info.recentFeatures,features.slice(-10).reverse());
  assert.ok(info.recentFeatures.every(feature=>!feature.subject.startsWith('fix:')));
  assert.equal(info.recentFeatures.length,10);
 }finally{rmSync(root,{recursive:true,force:true});}
});

test('returns empty Git history when the root is not a repository',()=>{
 const root=temporaryRoot();
 try{
  writeFileSync(join(root,'package.json'),JSON.stringify({version:'4.5.6'}));
  const info=readBuildInfo(root);
  assert.equal(info.version,'4.5.6');
  assert.equal(info.revision,'');
  assert.deepEqual(info.recentFeatures,[]);
 }finally{rmSync(root,{recursive:true,force:true});}
});

test('build info remains valid JSON with the package version',()=>{
 const root=temporaryRoot();
 try{
  writeFileSync(join(root,'package.json'),JSON.stringify({version:'7.8.9'}));
  const metadata=JSON.parse(JSON.stringify(readBuildInfo(root)));
  assert.equal(metadata.version,'7.8.9');
  assert.deepEqual(Object.keys(metadata),['version','revision','builtAt','recentFeatures','acknowledgements']);
 }finally{rmSync(root,{recursive:true,force:true});}
});

 test('refreshes acknowledgement text and safe links from README on each build',()=>{
 const root=temporaryRoot();
 try{
  writeFileSync(join(root,'package.json'),JSON.stringify({version:'1'}));
  writeFileSync(join(root,'README.md'),'# Reader\n\nThanks to [OpenAI](https://openai.com/) for support.\n');
  assert.deepEqual(readBuildInfo(root).acknowledgements.en,[{text:'Thanks to '},{text:'OpenAI',href:'https://openai.com/'},{text:' for support.'}]);
  writeFileSync(join(root,'README.md'),'Updated thanks to [Warp](https://www.warp.dev/).\n');
  assert.equal(readBuildInfo(root).acknowledgements.en[1].text,'Warp');
 }finally{rmSync(root,{recursive:true,force:true});}
});
