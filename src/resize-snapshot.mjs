// One native snapshot per settled view; drag frames only change compositor transforms.
export function createResizeSnapshot({workspace,reader,commit,metric,flush=async()=>{},state=()=>{},native=globalThis.window?.previewResize}){
 let cached=null,layer=null,token=0,captureTimer,endTimer,active=false,finishing=false,stops=[],frozenRail=null;
 const contentTop=()=>document.querySelector('.toolbar')?.getBoundingClientRect().bottom||0;
 async function decoded(value){if(!value?.dataUrl)return null;const img=new Image();img.src=value.dataUrl;await img.decode();return {...value,decoded:img};}
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 async function capture(){const id=token;if(active||!workspace()||!reader()?.querySelector('.page')||document.hidden)return;try{const value=await decoded(await native?.capture());if(id===token&&!active&&value?.dataUrl)cached={...value,reader:reader().getBoundingClientRect().toJSON(),width:innerWidth,height:innerHeight,top:contentTop()};}catch{}}
 function schedule(){clearTimeout(captureTimer);captureTimer=setTimeout(capture,500);}
 function show(image,kind){if(!image)return;const el=document.createElement('div');el.className='resize-snapshot';el.dataset.kind=kind;el.style.cssText=`position:fixed;inset:${contentTop()}px 0 0;z-index:15;overflow:hidden;pointer-events:none;background:var(--reader-background,#e4e4e5)`;
 const img=image.decoded||document.createElement('img');if(!img.src)img.src=image.dataUrl;img.draggable=false;img.style.cssText=`position:absolute;left:0;top:-${image.top||0}px;width:${image.width}px;height:${image.height}px;max-width:none;transform-origin:0 ${image.top||0}px;will-change:transform;`;
 el.append(img);document.body.append(el);layer={el,img,image};metric('snapshotTransitions');}
 function freeze(){const el=workspace();if(!el)return;const bounds=el.getBoundingClientRect();el.style.width=bounds.width+'px';el.style.height=bounds.height+'px';el.classList.add('layout-frozen');const rail=el.querySelector('.sidebar');if(rail){frozenRail={el:rail,flex:rail.style.flex,width:rail.style.width};rail.style.flex=`0 0 ${rail.getBoundingClientRect().width}px`;rail.style.width=rail.getBoundingClientRect().width+'px';}}
 function unfreeze(){const el=workspace();if(el){el.style.width='';el.style.height='';}if(frozenRail){frozenRail.el.style.flex=frozenRail.flex;frozenRail.el.style.width=frozenRail.width;frozenRail=null;}}
 function transform(){if(layer)layer.img.style.transform=`scale(${innerWidth/layer.image.width},${(innerHeight-contentTop())/(layer.image.height-(layer.image.top||0))})`;}
 function start(){if(active||!reader()?.querySelector('.page'))return;token++;active=true;state(true);finishing=false;clearTimeout(captureTimer);freeze();show(cached,'window');if(!cached){const id=token;void native?.capture().then(decoded).then(value=>{if(id===token&&active&&!finishing&&value?.dataUrl){show({...value,width:innerWidth,height:innerHeight,top:contentTop()},'window');transform();}}).catch(()=>{});}metric('count');}
 function resize(){if(finishing)return;start();transform();clearTimeout(endTimer);endTimer=setTimeout(finish,180);}
 async function finish(){if(!active||finishing)return;finishing=true;clearTimeout(endTimer);const id=token;const el=workspace();unfreeze();metric('layoutCommits');try{await commit();}finally{if(id===token){if(layer&&!reduced()){const animation=layer.el.animate([{opacity:1},{opacity:0}],{duration:100,easing:'ease-out'});await animation.finished.catch(()=>{});}if(id===token){layer?.el.remove();layer=null;el?.classList.remove('layout-frozen');active=false;finishing=false;state(false);cached=null;schedule();}}}}
 async function toggle(change){while(active&&finishing)await new Promise(requestAnimationFrame);if(active){await finish();if(active)return;}const id=++token;clearTimeout(captureTimer);let image=cached;try{const value=await decoded(await native?.capture());if(value?.dataUrl)image={...value,width:innerWidth,height:innerHeight,reader:reader().getBoundingClientRect().toJSON(),top:contentTop()};}catch{}if(id!==token)return;active=true;state(true);finishing=true;try{show(image,'sidebar');metric('count');const el=workspace();el?.classList.add('layout-frozen');change();await flush();if(id!==token)return;
 // Move and scale the captured reader as a single texture, including translated text.
 if(layer&&image?.reader&&!reduced()){
 const before=image.reader,after=reader().getBoundingClientRect(),slice=document.createElement('div'),img=layer.img.cloneNode();slice.style.cssText=`position:absolute;left:${before.left}px;top:${before.top-contentTop()}px;width:${before.width}px;height:${before.height}px;overflow:hidden;transform-origin:0 0;will-change:transform;`;
 img.style.left=-before.left+'px';img.style.top=-before.top+'px';img.style.transform='none';slice.append(img);layer.el.append(slice);layer.img.style.opacity='.25';
 const animation=slice.animate([{transform:'none'},{transform:`translate(${after.left-before.left}px,${after.top-before.top}px) scale(${after.width/before.width},${after.height/before.height})`}],{duration:180,easing:'cubic-bezier(.2,.7,.2,1)',fill:'forwards'});await animation.finished.catch(()=>{});
 }
 if(id===token){metric('layoutCommits');await commit();}
 }finally{if(id===token){layer?.el.remove();layer=null;workspace()?.classList.remove('layout-frozen');active=false;finishing=false;state(false);cached=null;schedule();}}}
 function cancel(){token++;clearTimeout(captureTimer);clearTimeout(endTimer);layer?.el.remove();layer=null;cached=null;const el=workspace();unfreeze();el?.classList.remove('layout-frozen');active=false;finishing=false;state(false);}
 if(native?.onStart)stops.push(native.onStart(start));if(native?.onEnd)stops.push(native.onEnd(()=>{clearTimeout(endTimer);endTimer=setTimeout(finish,180);}));
 return {resize,toggle,schedule,invalidate(){cached=null;schedule();},cancel,get active(){return active;},destroy(){cancel();stops.forEach(stop=>stop?.());}};
}
