<script setup>
import {computed,watch,ref,nextTick,onMounted,onBeforeUnmount} from 'vue';
import {t} from './i18n.mjs';
import {orderedAnnotations} from './sidebar-navigation.mjs';
const props=defineProps({mode:String,outline:Array,annotations:Array,selected:String,reducedMotion:Boolean});
const emit=defineEmits(['update:mode','page','annotation','ready']);
const collapsed=ref(new Set());
const view=ref();let viewMotion;
async function ready(){
 await nextTick();
 viewMotion?.cancel();
 if(!props.reducedMotion&&!matchMedia('(prefers-reduced-motion: reduce)').matches)viewMotion=view.value?.animate([{opacity:0,transform:'translateY(4px)'},{opacity:1,transform:'translateY(0)'}],{duration:180,easing:'ease'});
 emit('ready');
}
watch(()=>props.mode,ready,{flush:'post'});
onMounted(()=>emit('ready'));
onBeforeUnmount(()=>viewMotion?.cancel());
const tabs=computed(()=>['thumbnails',...(props.outline.length?['outline']:[]),...(props.annotations.length?['annotations']:[])]);
const selectedTab=computed(()=>Math.max(0,tabs.value.indexOf(props.mode)));
const visibleOutline=computed(()=>props.outline.filter(item=>!props.outline.some(parent=>collapsed.value.has(parent.id)&&item.id.startsWith(parent.id+'.'))));
function hasChildren(item){return props.outline.some(child=>child.id.startsWith(item.id+'.'));}
function toggleOutline(item){const next=new Set(collapsed.value);if(next.has(item.id))next.delete(item.id);else next.add(item.id);collapsed.value=next;}
watch(()=>props.outline,()=>collapsed.value=new Set());
const items=computed(()=>orderedAnnotations(props.annotations));
function annotationText(item){return (item.text||'').replace(/[\r\n\u2028\u2029]+/g,'').trim();}
watch(()=>[props.mode,props.outline.length,props.annotations.length],()=>{
 if(props.mode==='outline'&&!props.outline.length||props.mode==='annotations'&&!props.annotations.length)emit('update:mode','thumbnails');
},{immediate:true});
</script>
<template>
 <div ref="view" class="sidebar-view">
 <div v-show="mode==='thumbnails'" class="sidebar-thumbnail-view"><slot></slot></div>
 <div v-show="mode==='outline'" class="sidebar-navigation-list" :aria-label="t('sidebar.outline')">
  <div v-for="item in visibleOutline" :key="item.id" class="sidebar-outline-row" :style="{paddingLeft:6+Math.min(item.depth,8)*12+'px'}">
   <button v-if="hasChildren(item)" class="sidebar-outline-toggle" :aria-expanded="!collapsed.has(item.id)" :aria-label="t(collapsed.has(item.id)?'sidebar.expand':'sidebar.collapse',{title:item.title})" @click="toggleOutline(item)"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="m4 2 4 4-4 4"/></svg></button><span v-else class="sidebar-outline-spacer"></span>
   <button class="sidebar-outline-item" :disabled="!item.page" @click="emit('page',item.page)"><span>{{item.title}}</span><small v-if="item.page">{{item.page}}</small></button>
  </div>
 </div>
 <div v-show="mode==='annotations'" class="sidebar-navigation-list" :aria-label="t('sidebar.annotations')">
  <button v-for="item in items" :key="item.id" class="sidebar-annotation-item" :class="{selected:selected===item.id}" @click="emit('annotation',item)">
   <span class="sidebar-annotation-meta"><i :style="{background:item.color}"></i>{{t(item.origin==='translation'?'sidebar.translation':'sidebar.source')}} · {{t('sidebar.page',{page:item.page})}} · {{t(item.kind==='comment'?'sidebar.comment':'sidebar.highlight')}}</span>
   <span v-if="annotationText(item)" class="sidebar-annotation-text">{{annotationText(item)}}</span><span v-if="item.comment" class="sidebar-annotation-comment">{{item.comment}}</span>
   <span v-if="!annotationText(item)&&!item.comment">{{t('sidebar.highlight')}}</span>
  </button>
 </div>
 </div>
 <div v-if="outline.length||annotations.length" class="sidebar-navigation-switch" role="group" :aria-label="t('sidebar.view')">
  <span class="sidebar-tab-indicator" :style="{width:`calc((100% - 4px - ${(tabs.length-1)*2}px) / ${tabs.length})`,transform:`translateX(calc(${selectedTab*100}% + ${selectedTab*2}px))`}" aria-hidden="true"></span>
  <button v-for="tab in tabs" :key="tab" :aria-pressed="mode===tab" @click="emit('update:mode',tab)">{{t('sidebar.'+tab)}}</button>
 </div>
</template>
<style>
.sidebar-view{display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden}
.sidebar-thumbnail-view{display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden}
.sidebar-navigation-list{flex:1;min-height:0;overflow:auto;padding:8px 6px;scrollbar-width:thin}
.sidebar-outline-item,.sidebar-annotation-item{display:flex;width:100%;text-align:left;border:0;background:transparent;border-radius:6px;padding:9px 8px;color:var(--text);gap:8px;cursor:pointer}
.sidebar-outline-row{display:flex;align-items:flex-start;border-radius:6px}.sidebar-outline-item{flex:1;min-width:0;padding-left:2px}.sidebar-outline-spacer,.sidebar-outline-toggle{flex:0 0 20px;width:20px;height:32px}.sidebar-outline-toggle{border:0;background:transparent;padding:8px 4px;cursor:pointer}.sidebar-outline-toggle svg{width:12px;height:12px;fill:none;stroke:currentColor;stroke-width:1.6;transition:transform .18s ease}.sidebar-outline-toggle[aria-expanded=true] svg{transform:rotate(90deg)}
.sidebar-outline-item span{flex:1;overflow-wrap:anywhere}.sidebar-outline-item small{color:var(--text-secondary);flex-shrink:0}
.sidebar-outline-item:disabled{cursor:default;color:var(--text-secondary)}
.sidebar-annotation-item{flex-direction:column;gap:5px;border-bottom:1px solid var(--chrome-border)}
.sidebar-outline-row:has(.sidebar-outline-item:not(:disabled)):hover,.sidebar-annotation-item:hover,.sidebar-annotation-item.selected{background:var(--chrome-pressed)}
.sidebar-annotation-meta{font-size:10px;line-height:1;color:var(--text-secondary);display:flex;align-items:center;gap:4px}
.sidebar-annotation-meta i{width:1em;height:1em;box-sizing:border-box;border-radius:50%;corner-shape:round;flex-shrink:0;border:1px solid #0002}
.sidebar-annotation-text,.sidebar-annotation-comment{font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
.sidebar-annotation-comment{font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere}
.sidebar-navigation-switch{position:relative;display:flex;flex:0 0 auto;margin:8px;padding:2px;gap:2px;background:var(--chrome-pressed);border:1px solid var(--chrome-border);border-radius:7px}
.sidebar-navigation-switch button{position:relative;z-index:1;flex:1;min-width:0;border:0;border-radius:5px;padding:5px 2px;font-size:11px;background:transparent;cursor:pointer}
.sidebar-tab-indicator{position:absolute;top:2px;bottom:2px;left:2px;border-radius:5px;background:var(--chrome);box-shadow:0 1px 3px #0002;transition:transform .2s cubic-bezier(.22,.75,.2,1),width .2s ease;pointer-events:none}
[data-reduce-motion=true] :is(.sidebar-tab-indicator,.sidebar-outline-toggle svg){transition:none}
@media(prefers-reduced-motion:reduce){.sidebar-tab-indicator,.sidebar-outline-toggle svg,.sidebar-view-motion-enter-active,.sidebar-view-motion-leave-active{transition:none}}
.sidebar-navigation-switch button:focus-visible,.sidebar-navigation-list button:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.sidebar:has(.sidebar-navigation-switch),.sidebar:has(.sidebar-navigation-list){display:flex;flex-direction:column;overflow:hidden}
.sidebar .thumbnail-list{flex:1;min-height:0}

/* Inset macOS rows: selection is a soft surface, rather than a bordered card. */
/* Use visible circular arcs for sidebar surfaces beside native window corners. */
.app[data-platform="darwin"] .sidebar{
 --sidebar-edge-inset:10px;
 --sidebar-edge-radius:14px;
}
.app[data-platform="darwin"] .sidebar-navigation-list{padding:10px var(--sidebar-edge-inset)}
.app[data-platform="darwin"] .sidebar-annotation-item{
 border:0;border-radius:var(--sidebar-edge-radius);corner-shape:round;padding:10px;margin-bottom:4px;
 box-shadow:none;transition:background-color 120ms ease;
}
.app[data-platform="darwin"] .sidebar-annotation-item:hover{
 background:color-mix(in srgb,var(--text) 5%,transparent);
}
.app[data-platform="darwin"] .sidebar-annotation-item.selected{
 background:color-mix(in srgb,var(--text) 10%,transparent);
}
.app[data-platform="darwin"] .sidebar-outline-row,.app[data-platform="darwin"] .sidebar-outline-item{border-radius:var(--sidebar-edge-radius);corner-shape:round}
.app[data-platform="darwin"] .sidebar-navigation-switch{
 --sidebar-switch-radius:var(--sidebar-edge-radius);
 --sidebar-switch-inset:2px;
 margin:8px var(--sidebar-edge-inset) var(--sidebar-edge-inset);padding:var(--sidebar-switch-inset);border:0;border-radius:var(--sidebar-switch-radius);corner-shape:round;
 background:color-mix(in srgb,var(--text) 8%,transparent);
 box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--text) 6%,transparent);
}
.app[data-platform="darwin"] .sidebar-navigation-switch button,
.app[data-platform="darwin"] .sidebar-tab-indicator{
 border-radius:calc(var(--sidebar-switch-radius) - var(--sidebar-switch-inset));corner-shape:round;
}
.app[data-platform="darwin"] .sidebar-tab-indicator{
 box-shadow:0 1px 3px #00000014,inset 0 0 0 1px #ffffff18;
}
@media(prefers-reduced-motion:reduce){.app[data-platform="darwin"] .sidebar-annotation-item{transition:none}}
[data-reduce-motion=true] .app[data-platform="darwin"] .sidebar-annotation-item{transition:none}
</style>
