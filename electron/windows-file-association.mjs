import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {win32} from 'node:path';

const run=promisify(execFile);
const classes='HKCU\\Software\\Classes';
export function windowsPDFRegistryEntries(executable){
 if(typeof executable!=='string'||!win32.isAbsolute(executable)||/["\r\n\0]/.test(executable)||!/^PDFMathReader(?:-win32-(?:x64|ia32))?\.exe$/i.test(win32.basename(executable)))throw Error('Invalid PDFMathReader executable path.');
 const command=`"${executable}" "%1"`,icon=`"${executable}",0`;
 const application=`${classes}\\Applications\\PDFMathReader.exe`;
 const verb=`${classes}\\SystemFileAssociations\\.pdf\\shell\\PDFMathReader`;
 return [
  [application,'FriendlyAppName','PDFMathReader'],
  [`${application}\\SupportedTypes`,'.pdf',''],
  [`${application}\\shell\\open\\command`,'',command],
  [`${classes}\\.pdf\\OpenWithList\\PDFMathReader.exe`,'',''],
  [verb,'','Open with PDFMathReader'],
  [verb,'Icon',icon],
  [`${verb}\\command`,'',command],
 ];
}

export async function registerWindowsPDF({platform=process.platform,packaged=false,smoke=false,executable=process.env.PORTABLE_EXECUTABLE_FILE||process.execPath,execute=run}={}){
 if(platform!=='win32'||!packaged||smoke)return false;
 for(const [key,name,value] of windowsPDFRegistryEntries(executable)){
  await execute('reg.exe',['add',key,...(name?['/v',name]:['/ve']),'/t','REG_SZ','/d',value,'/f'],{windowsHide:true,timeout:10000});
 }
 return true;
}
