import {cp,mkdir,mkdtemp,readFile,writeFile,readdir,stat} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,join,resolve,relative} from 'node:path';
import {tmpdir} from 'node:os';
import {build} from 'esbuild';
import {hasNativeInspector} from '../server/pdf-extractor.mjs';
const runtimeElectron=['main.mjs','annotations.mjs','annotation-import.mjs','document-session.mjs','haptics.mjs','menu-i18n.mjs','backend-process.mjs','backend-service.mjs','credentials.mjs','atomic-file.mjs','documents.mjs','performance-tracker.mjs','preferences.mjs','recents.mjs','window-chrome.mjs','windows-file-association.mjs','preload.cjs'];
const runtimeServer=['index.mjs','translation-cache.mjs','reading-assist.mjs','translation-provider.mjs','documents.mjs','engines.mjs','kernel-options.mjs','layout.mjs','layout-extraction.mjs','pdf-extractor.mjs','performance.mjs'];
async function packageDirectory(name,from){
 const require=createRequire(join(from,'package.json'));let path;
 try{path=dirname(require.resolve(name+'/package.json'));}catch{
  try{path=dirname(require.resolve(name));}catch{
   for(const directory of require.resolve.paths(name)||[]){const candidate=join(directory,name);try{if(JSON.parse(await readFile(join(candidate,'package.json'),'utf8')).name===name){path=candidate;break;}}catch{}}
   if(!path)throw Error('Cannot locate '+name);
  }
 }
 for(;;){try{const metadata=JSON.parse(await readFile(join(path,'package.json'),'utf8'));if(metadata.name===name)return path;}catch{}const next=dirname(path);if(next===path)throw Error('Cannot locate '+name);path=next;}
}
async function copyDependencies(root,stage,names,fallback=false){
 const copied=new Map();
 async function copy(name,from,optional=false){
  let source;try{source=await packageDirectory(name,from);}catch(error){if(optional)return;throw error;}
  if(copied.has(source))return;
  const location=relative(join(root,'node_modules'),source);if(location.startsWith('..'))throw Error('Dependency outside project: '+source);
  copied.set(source,name);const target=join(stage,'node_modules',location);
  await cp(source,target,{recursive:true,dereference:true,filter:path=>!path.slice(source.length).split(/[\\/]/).includes('node_modules')});
  const metadata=JSON.parse(await readFile(join(source,'package.json'),'utf8'));
  for(const dependency of Object.keys(metadata.dependencies||{}))await copy(dependency,source);
  if(name!=='pdfjs-dist'&&!(fallback&&name==='@firecrawl/pdf-inspector'))for(const dependency of Object.keys(metadata.optionalDependencies||{}))await copy(dependency,source,true);
 }
 for(const name of names)await copy(name,root);
 return copied;
}
export async function stageApplication({root=process.cwd(),phase='bundle',test=false,platform=process.platform,arch=process.arch}={}){
 if(!['whitelist','pdf','skia','dependencies','bundle'].includes(phase))throw Error('Unknown package stage: '+phase);
 root=resolve(root);const stage=await mkdtemp(join(tmpdir(),'pdfmathreader-stage-'));
 const metadata=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
 await mkdir(join(stage,'electron'),{recursive:true});await mkdir(join(stage,'server'),{recursive:true});
 await cp(join(root,'dist'),join(stage,'dist'),{recursive:true});
 await cp(join(root,'electron/AppIcon.png'),join(stage,'electron/AppIcon.png'));
 for(const file of runtimeElectron)await cp(join(root,'electron',file),join(stage,'electron',file));
 for(const file of runtimeServer)await cp(join(root,'server',file),join(stage,'server',file));
 await cp(join(root,'electron/kernel-worker.py'),join(stage,'electron/kernel-worker.py'));
 await cp(join(root,'electron/kernel-options.py'),join(stage,'electron/kernel-options.py'));
 if(test)for(const file of await readdir(join(root,'electron')))if(file==='smoke.mjs'||file.endsWith('-smoke.mjs'))await cp(join(root,'electron',file),join(stage,'electron',file));
 const names=['whitelist','pdf','skia'].includes(phase)?Object.keys(metadata.dependencies):phase==='dependencies'?['express','pdf-lib','@firecrawl/pdf-inspector']:['@firecrawl/pdf-inspector'];
 if(test&&!names.includes('pdf-lib'))names.push('pdf-lib');
 const fallback=!hasNativeInspector(platform,arch);
 if(fallback&&!names.includes('pdfjs-dist'))names.push('pdfjs-dist');
 if(fallback&&!names.includes('@thednp/dommatrix'))names.push('@thednp/dommatrix');
 const copied=await copyDependencies(root,stage,names,fallback);
 const browserLicenses=['@fluentui/web-components','@fluentui/tokens','tslib','@macvue/core','reka-ui','vue','@vue/shared','@vue/reactivity','@vue/runtime-core','@vue/runtime-dom','pdfjs-dist'];
 for(const name of browserLicenses){const source=await packageDirectory(name,root);const target=join(stage,'licenses',name);await mkdir(target,{recursive:true});for(const file of await readdir(source))if(/^(licen[sc]e|copying|notice)(\.|$)/i.test(file))await cp(join(source,file),join(target,file));}
 if(['pdf','skia','dependencies'].includes(phase)){
  const {rm}=await import('node:fs/promises');if(phase!=='dependencies'&&!fallback)await rm(join(stage,'node_modules/pdfjs-dist'),{recursive:true,force:true});
  if(phase==='skia')for(const directory of ['@napi-rs/canvas','@napi-rs/canvas-darwin-arm64'])await rm(join(stage,'node_modules',directory),{recursive:true,force:true});
  // Node uses pdf-lib's CJS entry; the renderer already contains its own PDF.js bundle.
  for(const directory of ['dist','es','src','ts3.4','apps'])await rm(join(stage,'node_modules/pdf-lib',directory),{recursive:true,force:true});
 }
 if(phase==='bundle'){
  const preserveBundleLicenses=async result=>{
   const packages=new Set();for(const path of Object.keys(result.metafile.inputs)){const match=path.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/);if(match)packages.add(match[1]);}
   for(const name of packages){const source=await packageDirectory(name,root);const target=join(stage,'licenses',name);await mkdir(target,{recursive:true});for(const file of await readdir(source))if(/^(licen[sc]e|copying|notice)(\.|$)/i.test(file))await cp(join(source,file),join(target,file));}
  };
  const common={bundle:true,metafile:true,banner:{js:"import {createRequire as __createRequire} from 'node:module';const require=__createRequire(import.meta.url);"},platform:'node',format:'esm',target:'node22',minify:true,sourcemap:false,legalComments:'eof',mainFields:['module','main'],external:['electron','@firecrawl/pdf-inspector','@firecrawl/pdf-inspector/*','pdfjs-dist/*','vite']};
  await build({...common,entryPoints:[join(root,'server/index.mjs')],outfile:join(stage,'server/index.mjs'),metafile:true}).then(preserveBundleLicenses);
  // Smoke imports remain external so the same production bundle can be exercised in a test-only package.
  await build({...common,entryPoints:[join(root,'electron/main.mjs')],outfile:join(stage,'electron/main.mjs'),plugins:[{name:'smoke-modules',setup(build){build.onResolve({filter:/\.\/(?:smoke|.*-smoke)\.mjs$/},args=>({path:args.path,external:true}));}}]}).then(preserveBundleLicenses);
  const {rm}=await import('node:fs/promises');for(const file of runtimeElectron)if(!test&&!['main.mjs','haptics.mjs','menu-i18n.mjs','backend-process.mjs','preload.cjs'].includes(file))await rm(join(stage,'electron',file));
  for(const file of runtimeServer)if(file!=='index.mjs')await rm(join(stage,'server',file));
 }
 await writeFile(join(stage,'package.json'),JSON.stringify({name:metadata.name,version:metadata.version,description:metadata.description,private:true,type:'module',main:'electron/main.mjs',dependencies:Object.fromEntries(names.map(name=>[name,metadata.dependencies[name]]))},null,2));
 return {stage,phase,test,packages:[...copied.values()]};
}
export async function directoryBytes(path){let bytes=0;for(const entry of await readdir(path,{withFileTypes:true})){if(entry.isSymbolicLink())continue;const child=join(path,entry.name);if(entry.isDirectory())bytes+=await directoryBytes(child);else bytes+=(await stat(child)).size;}return bytes;}
if(process.argv[1]&&resolve(process.argv[1])===new URL(import.meta.url).pathname){const result=await stageApplication({phase:process.argv[2]||'bundle',test:process.argv.includes('--test')});console.log(JSON.stringify({...result,bytes:await directoryBytes(result.stage)},null,2));}
