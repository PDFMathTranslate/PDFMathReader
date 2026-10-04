<script setup>
import {computed} from 'vue';
import {uiLanguage} from './i18n.mjs';
import {topicSentenceLength} from './topic-sentences.mjs';
import {informationTextSegments} from './information-emphasis.mjs';
const props=defineProps({text:String,enabled:Boolean,information:Boolean});
const parts=computed(()=>informationTextSegments(props.text||'',{topicEnd:props.enabled?topicSentenceLength(props.text||'',uiLanguage.value):0,emphasizeInformation:props.information}));
</script>
<template><template v-for="part in parts" :key="part.start"><component :is="part.topic?'strong':'span'" :class="{'topic-sentence-text':part.topic}"><mark v-if="part.important" class="information-keyword">{{part.text}}</mark><template v-else>{{part.text}}</template></component></template></template>
<style>
.topic-sentence-text{font-weight:inherit;background:color-mix(in srgb,var(--accent) 10%,transparent);border-radius:2px;box-decoration-break:clone;-webkit-box-decoration-break:clone}
.information-keyword{font:inherit;color:inherit;background:transparent;padding:0;text-decoration:underline;text-decoration-color:color-mix(in srgb,var(--accent) 65%,transparent);text-decoration-thickness:.08em;text-underline-offset:.16em;text-decoration-skip-ink:auto}
</style>
