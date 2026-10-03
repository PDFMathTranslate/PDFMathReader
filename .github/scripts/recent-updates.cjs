const {execFileSync}=require('node:child_process');
const {readFileSync,writeFileSync}=require('node:fs');

const feature=/^feat(?:\([^\r\n)]+\))?!?:\s*(.+)$/;
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const escape=value=>String(value).replace(/[\\`*_[\]<>|]/g,char=>`\\${char}`).replace(/[\r\n]+/g,' ');

function replaceUpdates(readme,rows){
 const section=/^## Recent updates\r?\n[\s\S]*?(?=^## |$(?![\s\S]))/m;
 if(!section.test(readme))throw Error('README.md must contain a Recent updates section.');
 return readme.replace(section,()=>`## Recent updates\n\n| Date | Feature | Contributor |\n| --- | --- | --- |\n${rows.join('\n')}\n\n`);
}

module.exports=async({github,context,core})=>{
 const {before,after,created,deleted}=context.payload;
 if(deleted)return;
 const range=created||!before||/^0+$/.test(before)?[after]:[`${before}..${after}`];
 // A multi-commit push can contain feat even when its newest commit is a fix.
 const subjects=git('log','--format=%s',...range).split('\n');
 if(!subjects.some(subject=>feature.test(subject))){core.info('No feat commits in this push.');return;}
 const readme=readFileSync('README.md','utf8');
 const previous=new Map([...readme.matchAll(/\[([^\n]+?)\]\(https:\/\/[^\s)]+\/commit\/([a-f0-9]{40})\)/g)].map(match=>[match[2],match[1]]));
 const history=git('log','--format=%H%x00%aI%x00%s').split('\n').map(line=>line.split('\0'));
 const updates=[];
 for(const [sha,date,subject] of history){
  const match=subject.match(feature);if(!match)continue;
  // Badge/documentation-only commits do not describe an application feature.
  const files=git('diff-tree','--root','--no-commit-id','--name-only','-r',sha).split('\n').filter(Boolean);
  if(!files.some(file=>!file.endsWith('.md')&&!file.startsWith('doc/')))continue;
  updates.push({sha,date,subject:match[1]});
 }
 updates.sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));
 const rows=await Promise.all(updates.slice(0,7).map(async({sha,date,subject})=>{
  const {data}=await github.rest.repos.getCommit({...context.repo,ref:sha});
  const author=data.author;
  const contributor=author?`[@${escape(author.login)}](${author.html_url})`:`[${escape(data.commit.author.name)}](${data.html_url})`;
  // Use the calendar date recorded by Git; display no time or timezone.
  return `| ${date.slice(0,10)} | [${previous.get(sha)||escape(subject)}](${data.html_url}) | ${contributor} |`;
 }));
 const updated=replaceUpdates(readme,rows);
 if(updated===readme){core.info('Recent updates already current.');return;}
 writeFileSync('README.md',updated);
 core.setOutput('changed','true');
};
module.exports.replaceUpdates=replaceUpdates;
