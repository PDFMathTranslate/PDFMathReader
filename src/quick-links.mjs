export function quickLinkBox(block,translated){
 const box=block?.math?(translated?block.translatedBox:block.sourceBox):block;
 return box&&['x','y','width','height'].every(key=>Number.isFinite(box[key]))?{x:box.x,y:box.y,width:box.width,height:box.height}:null;
}
export function quickLinkAnchor(page,view,hitBox,translated){
 const point=hitBox||{x:Math.max(0,view.offsetX*page.width),y:Math.max(0,view.offsetY*page.height)};
 let nearest;
 for(const block of page.blocks){const box=quickLinkBox(block,translated);if(!box)continue;const distance=Math.hypot(Math.max(box.x-point.x,0,point.x-box.x-box.width),Math.max(box.y-point.y,0,point.y-box.y-box.height));if(!nearest||distance<nearest.distance)nearest={block,box,distance};}
 const box=nearest?.box||hitBox||{x:point.x,y:point.y,width:page.width*.8,height:20};
 return {page:page.number,blockId:nearest?.block.id,box};
}
