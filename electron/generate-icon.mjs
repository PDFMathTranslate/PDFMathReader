import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const source=fileURLToPath(new URL('../doc/icon.png',import.meta.url));
const iconset=fileURLToPath(new URL('./AppIcon.iconset',import.meta.url));
mkdirSync(iconset,{recursive:true});
for(const size of [16,32,128,256,512]){
  for(const scale of [1,2]){
    const pixels=String(size*scale);
    execFileSync('/usr/bin/sips',['-z',pixels,pixels,source,'--out',`${iconset}/icon_${size}x${size}${scale===2?'@2x':''}.png`],{stdio:'ignore'});
  }
}
const entries=[['icp4',16,1],['icp5',32,1],['ic07',128,1],['ic08',256,1],['ic09',512,1],['ic10',512,2],['ic11',16,2],['ic12',32,2],['ic13',128,2],['ic14',256,2]];
const chunks=entries.map(([type,size,scale])=>{
  const png=readFileSync(`${iconset}/icon_${size}x${size}${scale===2?'@2x':''}.png`);
  const header=Buffer.alloc(8);header.write(type);header.writeUInt32BE(png.length+8,4);
  return Buffer.concat([header,png]);
});
const header=Buffer.alloc(8);header.write('icns');header.writeUInt32BE(8+chunks.reduce((total,chunk)=>total+chunk.length,0),4);
writeFileSync(fileURLToPath(new URL('./AppIcon.icns',import.meta.url)),Buffer.concat([header,...chunks]));
console.log('Generated macOS application icon from doc/icon.png');
