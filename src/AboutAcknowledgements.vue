<script setup>
import {computed,onMounted,ref} from 'vue';
import {uiLanguage} from './i18n.mjs';
import {loadBuildInfo} from './build-info.mjs';
const info=ref(null);
const parts=computed(()=>info.value?.acknowledgements?.[uiLanguage.value]||info.value?.acknowledgements?.en||[]);
onMounted(async()=>{try{info.value=await loadBuildInfo();}catch{}});
</script>
<template>
 <p v-if="parts.length" class="muted about-acknowledgements"><template v-for="(part,index) in parts" :key="index"><a v-if="part.href" :href="part.href" target="_blank" rel="noopener noreferrer">{{part.text}}</a><template v-else>{{part.text}}</template></template></p>
</template>
<style scoped>
.about-acknowledgements{line-height:1.6;overflow-wrap:anywhere}
a{color:var(--accent);text-decoration:underline;text-underline-offset:2px}
</style>
