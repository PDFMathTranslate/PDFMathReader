// Upstream vN tokens refer to original formula/font runs, not literal prose.
export function restoreFormulaPlaceholders(block) {
 const formulas=block.formulaTexts;
 if(!Array.isArray(formulas)||typeof block.translation!=='string')return block;
 const token=/\{+\s*v\s*(\d+|\*)\s*\}+/gi;
 const source=typeof block.sourceInput==='string'?block.sourceInput:'';
 const ids=[...new Set([...source.matchAll(token)].filter(m=>m[1]!=='*').map(m=>Number(m[1])))];
 const wildcardId=ids.length===1?ids[0]:undefined;
 let unresolved=false;
 const translation=block.translation.replace(token,(match,id)=>{
  const index=id==='*'?wildcardId:Number(id);
  if(index===undefined||typeof formulas[index]!=='string'){unresolved=true;return match;}
  return formulas[index];
 });
 // A malformed wildcard is ambiguous when multiple original runs exist.
 // Preserve the original paragraph rather than invent or discard its content.
 return {...block,translation:unresolved?(block.text||block.translation):translation};
}
