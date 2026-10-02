import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {homedir} from 'node:os';
import {join} from 'node:path';
const python=join(homedir(),'Library/Application Support/PDFMathReader/engines/pdf_math_fast/bin/python');
test('Fast regions use the already cropped and rotated visible-page frame',{skip:!existsSync(python)},()=>{
 const output=execFileSync(python,['-c',`
import importlib.util, pymupdf
spec=importlib.util.spec_from_file_location('adapter','electron/kernel-worker.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
for rotation in (0,90,180,270):
 doc=pymupdf.open();page=doc.new_page(width=595,height=842)
 page.set_cropbox(pymupdf.Rect(98,110,494,722));page.set_rotation(rotation)
 h=page.rect.height
 box=module.layout_box((64,h-180,320,h-140),page,'pdf_math_fast')
 assert box == dict(x=64.0,y=140.0,width=256.0,height=40.0), (rotation,box)
 doc.close()
doc=pymupdf.open();page=doc.new_page(width=396,height=612)
assert module.layout_box((64,432,320,472),page,'pdf_math_fast') == dict(x=64.0,y=140.0,width=256.0,height=40.0)
print('cropped, rotated, and ordinary pages passed')
`],{cwd:process.cwd(),encoding:'utf8'});
 assert.match(output,/passed/);
});
