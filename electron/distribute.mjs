import {access,readFile,stat} from 'node:fs/promises';
import {basename,join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';

// Archive the application bundle itself on macOS, and wrap the entire Windows
// runtime in a portable launcher so users never have to manage Electron DLLs.
export async function distributeApplication({path,platform,arch,electronVersion}){
 const name=`PDFMathReader-${platform}-${arch}`,output=resolve(path,'..');
 const resources=platform==='darwin'?join(path,'PDFMathReader.app/Contents/Resources'):join(path,'resources');
 await access(join(resources,'app.asar'));
 const executable=platform==='darwin'?join(path,'PDFMathReader.app/Contents/MacOS/PDFMathReader'):join(path,platform==='win32'?'PDFMathReader.exe':'PDFMathReader');
 if(!(await stat(executable)).size)throw Error(`Empty application executable: ${executable}`);
 let artifact;
 if(platform==='darwin'){
  artifact=join(output,`${name}.zip`);
  execFileSync('/usr/bin/ditto',['-c','-k','--sequesterRsrc','--keepParent',join(path,'PDFMathReader.app'),artifact],{stdio:'inherit'});
 }else if(platform==='win32'){
  const {build,Platform,Arch}=await import('electron-builder');
  await build({prepackaged:path,targets:Platform.WINDOWS.createTarget('portable',Arch[arch]),publish:'never',config:{
   appId:'local.previewtranslate.reader',productName:'PDFMathReader',electronVersion,
   directories:{output},artifactName:`${name}.exe`,
   win:{icon:resolve('electron/AppIcon.ico'),signAndEditExecutable:false},
   portable:{requestExecutionLevel:'user'},
  }});
  artifact=join(output,`${name}.exe`);
  const binary=await readFile(artifact);
  if(binary.subarray(0,2).toString()!=='MZ')throw Error(`Invalid Windows executable: ${artifact}`);
 }else{
  artifact=join(output,`${name}.tar.gz`);
  execFileSync('tar',['-czf',artifact,'-C',output,basename(path)],{stdio:'inherit'});
 }
 if(!(await stat(artifact)).size)throw Error(`Empty distribution: ${artifact}`);
 console.log(`Runnable distribution: ${artifact}`);
 return artifact;
}
