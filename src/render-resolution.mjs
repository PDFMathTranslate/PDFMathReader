// Prioritize readable visible pages while bounding individual backing stores.
export function renderPixelRatio(width,height,screenRatio=1,visible=true){
 const bytes=(visible?64:16)*1024*1024;
 return Math.min(Math.max(1,screenRatio),Math.sqrt(bytes/(width*height*4)),16384/Math.max(width,height));
}

// Scrolling previews bound pixel work, then settled views use the full ratio.
export function scrollPixelRatio(width,height,screenRatio=1){
 return Math.min(1,renderPixelRatio(width,height,screenRatio,true),Math.sqrt(4*1024*1024/(width*height*4)));
}
