import test from 'node:test';
import assert from 'node:assert/strict';
import {restoreFormulaPlaceholders as restore} from '../src/formula-placeholders.mjs';
test('ambiguous and invalid placeholders preserve original content',()=>{
 const base={text:'Original x y',sourceInput:'{{v0}} {{v1}}',formulaTexts:['x','y']};
 assert.equal(restore({...base,translation:'译文{v*}'}).translation,base.text);
 assert.equal(restore({...base,translation:'译文{v9}'}).translation,base.text);
 assert.equal(restore({...base,translation:'译文{v0}和{v1}'}).translation,'译文x和y');
 assert.equal(restore({...base,translation:'没有标记'}).translation,'没有标记');
});
