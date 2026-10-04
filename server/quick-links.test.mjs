import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {quickLinkAnchor,quickLinkBox} from '../src/quick-links.mjs';
import {createQuickLinkStore} from '../electron/quick-links.mjs';
test('kernel paragraph links save, reopen, and resolve in original and translated coordinates',async()=>{
 const root=await mkdtemp(join(tmpdir(),'quick-link-kernel-'));
 try{
  const block={id:'fast-1',math:true,sourceBox:{x:20,y:80,width:200,height:30},translatedBox:{x:20,y:70,width:200,height:60}};
  const page={number:1,width:400,height:600,blocks:[block]},view={offsetX:0,offsetY:0,showTranslations:true};
  const origin=quickLinkAnchor(page,view,null,false),result=quickLinkAnchor(page,view,{x:30,y:75,width:20,height:15},true);
  assert.deepEqual(origin.box,block.sourceBox);assert.deepEqual(result.box,block.translatedBox);
  const link={id:'paired-link',origin,result};
  await createQuickLinkStore(root).save('document',[link]);
  assert.deepEqual(await createQuickLinkStore(root).load('document'),[link]);
  assert.deepEqual(quickLinkBox(block,false),block.sourceBox);assert.deepEqual(quickLinkBox(block,true),block.translatedBox);
  assert.deepEqual(quickLinkBox({x:1,y:2,width:3,height:4},true),{x:1,y:2,width:3,height:4});
 }finally{await rm(root,{recursive:true,force:true});}
});
