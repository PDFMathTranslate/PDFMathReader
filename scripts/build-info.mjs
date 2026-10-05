import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const featureSubject=/^feat(?:\([^\r\n)]+\))?!?:\s*(.+)$/;

function git(root,args){
 return execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
}

export function readBuildInfo(root){
 const packageJson=JSON.parse(readFileSync(resolve(root,'package.json'),'utf8'));
 let revision='';
 let recentFeatures=[];
 try{revision=git(root,['rev-parse','HEAD']);}catch{}
 try{
  recentFeatures=git(root,['log','--extended-regexp','--grep=^feat(\\([^)]*\\))?!?:','--max-count=10','--format=%H%x00%cI%x00%s']).split('\n').filter(Boolean).flatMap(line=>{
   const [hash,date,subject]=line.split('\0');
   const match=subject?.match(featureSubject);
   return match?[{hash,date,subject:match[1].trim()}]:[];
  }).slice(0,10);
 }catch{}
 return {version:packageJson.version||'',revision,builtAt:new Date().toISOString(),recentFeatures};
}
