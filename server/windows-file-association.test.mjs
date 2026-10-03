import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerWindowsPDF,windowsPDFRegistryEntries} from '../electron/windows-file-association.mjs';

test('Windows PDF registration quotes paths and preserves the default reader',async()=>{
 const executable='C:\\Users\\reader\\PDF Reader 中文\\PDFMathReader.exe',calls=[];
 assert.equal(await registerWindowsPDF({platform:'win32',packaged:true,executable,execute:async(...args)=>calls.push(args)}),true);
 assert.equal(calls.length,7);
 for(const [program,args,options] of calls){
  assert.equal(program,'reg.exe');assert.ok(args[1].startsWith('HKCU\\Software\\Classes\\'));
  assert.equal(options.windowsHide,true);assert.ok(!args[1].includes('UserChoice'));
  if(args[1].endsWith('\\command'))assert.equal(args[args.indexOf('/d')+1],`"${executable}" "%1"`);
 }
 assert.ok(calls.some(([,args])=>args[1].includes('SystemFileAssociations\\.pdf\\shell\\PDFMathReader')));
 assert.ok(!calls.some(([,args])=>args[1]==='HKCU\\Software\\Classes\\.pdf'));
});

test('Development, smoke tests and other platforms never register file menus',async()=>{
 for(const options of [{platform:'darwin',packaged:true},{platform:'win32',packaged:false},{platform:'win32',packaged:true,smoke:true}]){
  assert.equal(await registerWindowsPDF({...options,execute:()=>assert.fail('Registry must not be modified')}),false);
 }
});

test('Portable builds register the persistent launcher rather than the temporary runtime',async()=>{
 const previous=process.env.PORTABLE_EXECUTABLE_FILE;
 const launcher='C:\\Users\\reader\\Downloads\\PDFMathReader-win32-x64.exe',calls=[];
 process.env.PORTABLE_EXECUTABLE_FILE=launcher;
 try{
  await registerWindowsPDF({platform:'win32',packaged:true,execute:async(...args)=>calls.push(args)});
  for(const [,args] of calls)if(args[1].endsWith('\\command'))assert.equal(args[args.indexOf('/d')+1],`"${launcher}" "%1"`);
 }finally{
  if(previous===undefined)delete process.env.PORTABLE_EXECUTABLE_FILE;else process.env.PORTABLE_EXECUTABLE_FILE=previous;
 }
});

test('Invalid executables and registry failures are reported',async()=>{
 for(const executable of ['relative.exe','C:\\other.exe','C:\\bad"path\\PDFMathReader.exe'])assert.throws(()=>windowsPDFRegistryEntries(executable));
 await assert.rejects(registerWindowsPDF({platform:'win32',packaged:true,executable:'C:\\PDFMathReader.exe',execute:async()=>{throw Error('Access denied');}}),/Access denied/);
});
