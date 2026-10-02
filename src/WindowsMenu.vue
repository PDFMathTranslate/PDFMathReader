<script setup>
import {ref,computed,nextTick} from 'vue';
import {menuLabel} from '../electron/menu-i18n.mjs';
import {uiLanguage} from './i18n.mjs';
const emit=defineEmits(['open','close']);
const open=ref(false),items=ref([]),trail=ref([]),panel=ref(),trigger=ref(),failure=ref('');
let generation=0;
const current=computed(()=>trail.value.at(-1)?.submenu||items.value);
const label=computed(()=>menuLabel('Menu',uiLanguage.value));
function close(restore=false){++generation;open.value=false;trail.value=[];emit('close');if(restore)trigger.value?.focus();}
async function toggle(){
 if(open.value){close();return;}
 emit('open');const token=++generation;failure.value='';
 try{const result=await window.previewWindow.menu();if(token!==generation)return;items.value=result;open.value=true;await nextTick();focusFirst();}
 catch{if(token===generation){failure.value=menuLabel('Menu unavailable',uiLanguage.value);open.value=true;}}
}
function focusFirst(){panel.value?.querySelector('button:not(:disabled)')?.focus();}
async function choose(item){
 if(item.submenu?.length){trail.value.push(item);await nextTick();focusFirst();return;}
 close(true);await nextTick();await window.previewWindow.menuAction(item.path);
}
async function back(){trail.value.pop();await nextTick();focusFirst();}
function keydown(event){
 if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);return;}
 if(event.key==='Tab'){close();return;}
 if(event.key==='ArrowLeft'&&trail.value.length){event.preventDefault();void back();return;}
 if(event.key==='ArrowRight'){const index=Number(event.target.dataset.index),item=current.value[index];if(item?.submenu?.length){event.preventDefault();void choose(item);}return;}
 const buttons=[...panel.value.querySelectorAll('button:not(:disabled)')],index=buttons.indexOf(document.activeElement);
 const next=event.key==='ArrowDown'?(index+1)%buttons.length:event.key==='ArrowUp'?(index-1+buttons.length)%buttons.length:event.key==='Home'?0:event.key==='End'?buttons.length-1:null;
 if(next!==null){event.preventDefault();buttons[next]?.focus();}
}
defineExpose({close,toggle});
</script>

<template>
 <div class="windows-menu" data-popover-trigger @keydown="keydown" @focusout="event=>{if(event.relatedTarget&&!event.currentTarget.contains(event.relatedTarget))close();}">
  <button ref="trigger" class="windows-menu-trigger" :aria-label="label" :title="label" aria-haspopup="menu" :aria-expanded="open" @click="toggle"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button>
  <div v-if="open" ref="panel" class="windows-menu-panel" role="menu" :aria-label="label">
   <button v-if="trail.length" class="windows-menu-back" role="menuitem" @click="back">‹ {{trail.at(-1).label.replaceAll('&','')}}</button>
   <p v-if="failure" role="status">{{failure}}</p>
   <template v-for="(item,index) in current" :key="item.path.join('.')">
    <div v-if="item.type==='separator'" role="separator" class="windows-menu-separator"></div>
    <button v-else class="windows-menu-item" :data-index="index" :role="item.type==='checkbox'?'menuitemcheckbox':item.type==='radio'?'menuitemradio':'menuitem'" :aria-checked="['checkbox','radio'].includes(item.type)?!!item.checked:undefined" :aria-haspopup="item.submenu?.length?'menu':undefined" :disabled="item.enabled===false" @click="choose(item)"><span class="windows-menu-check">{{item.checked?'✓':''}}</span><span>{{item.label.replaceAll('&','')}}</span><small>{{item.accelerator?.replace('CommandOrControl','Ctrl')}}</small><span v-if="item.submenu?.length">›</span></button>
   </template>
  </div>
 </div>
</template>
