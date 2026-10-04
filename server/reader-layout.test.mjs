import {test} from 'node:test';import assert from 'node:assert/strict';
import {buildReaderLayout,visibleReaderWindow,buildThumbnailLayout,visibleThumbnailWindow} from '../src/reader-layout.mjs';
const pages=Array.from({length:1000},(_,i)=>({number:i+1,width:i%2?792:612,height:i%2?612:792}));
test('mixed-size row geometry preserves column widths, gaps and four buffered rows',()=>{for(const columns of [1,2,4]){const layout=buildReaderLayout(pages,1,'vertical',columns),row=layout.rows[80],bounds={top:row.offset+100,bottom:row.offset+600,left:0,right:layout.width};const result=visibleReaderWindow(layout,bounds);assert.equal(result.firstRow,76);assert.equal(result.lastRow,84);assert.equal(result.numbers.length,9*columns);assert.equal(layout.frames[columns].y-layout.frames[0].height,24);assert.ok(result.visible.every(v=>v.row===80));assert.equal(layout.height,layout.rows.at(-1).offset+layout.rows.at(-1).extent);}});

test('mixed orientations use a fixed horizontal gap and center each packed row',()=>{
 const input=[{number:1,width:400,height:600},{number:2,width:400,height:600},{number:3,width:600,height:400},{number:4,width:400,height:600}];
 const layout=buildReaderLayout(input,1,'vertical',2,24,2);
 for(let i=0;i<4;i+=2){const left=layout.frames[i],right=layout.frames[i+1];assert.equal(right.x-left.x-left.width,24);assert.equal(left.x,layout.width-right.x-right.width);}
 assert.equal(layout.frames[2].y-layout.frames[0].height,24);
});
