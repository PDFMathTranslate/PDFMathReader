export function transformPageAnnotations(annotations,transforms){
 const byPage=new Map(transforms.map(value=>[value.page,value]));
 return annotations.map(annotation=>{
  const transform=byPage.get(annotation.page);if(!transform)return {...annotation};
  const rect=value=>{
   if(!value)return value;
   const scale=transform.scale||1;
   const rotated=transform.rotate===90?{x:transform.height-value.y-value.height,y:value.x,width:value.height,height:value.width}:value;
   return {...value,x:rotated.x*scale,y:rotated.y*scale,width:rotated.width*scale,height:rotated.height*scale};
  };
  return {...annotation,rects:annotation.rects.map(rect),...(annotation.sourceRect?{sourceRect:rect(annotation.sourceRect)}:{}),...(annotation.translationRect?{translationRect:rect(annotation.translationRect)}:{})};
 });
}
