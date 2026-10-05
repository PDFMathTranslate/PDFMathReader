<script setup>
import {computed,ref,watch,onBeforeUnmount} from 'vue';
import {MacButton,MacPopUpButton,MacPopUpButtonItem,MacSecureField,MacSwitch,MacTextField} from './platform-controls.mjs';
import {cloneTranslationServices,loadTranslationServiceSchema} from './translation-services.mjs';
import {t} from './i18n.mjs';

const props=defineProps({
	engine:{type:String,default:''},
	engineState:{type:Object,default:null},
	catalogRevision:{type:Number,default:0},
 modelValue:{type:Object,default:()=>({})},
 advancedOptions:{type:Object,default:()=>({})},
 credentials:{type:Object,default:()=>({})}
});
const emit=defineEmits(['update:modelValue','update:advancedOptions','update:credentials','update:request']);
const schema=ref(null),busy=ref(false),message=ref(''),retry=ref(0);
let generation=0,credentialWrites=Promise.resolve();

const config=computed(()=>{
 const value=props.modelValue?.[props.engine];
 return value&&typeof value==='object'&&!Array.isArray(value)?value:{};
});
const services=computed(()=>Array.isArray(schema.value?.services)?schema.value.services:[]);
const serviceById=id=>services.value.find(service=>service.id===id);
const selectedId=computed(()=>typeof config.value.id==='string'&&message.value?config.value.id:serviceById(config.value.id)?.id||services.value[0]?.id||config.value.id||'auto');
const selectedService=computed(()=>serviceById(selectedId.value));
const profiles=computed(()=>config.value.profiles&&typeof config.value.profiles==='object'&&!Array.isArray(config.value.profiles)?config.value.profiles:{});
const selectedProfileValues=computed(()=>{
 const profile=profiles.value[selectedId.value];
 if(profile?.values&&typeof profile.values==='object'&&!Array.isArray(profile.values))return profile.values;
 if(selectedId.value===config.value.id&&config.value.values&&typeof config.value.values==='object'&&!Array.isArray(config.value.values))return config.value.values;
 return {};
});
const promptOption=computed(()=>{
 if(selectedId.value==='apple-local'||selectedService.value?.supportsPrompt===false)return null;
 if(props.engine==='pdf_math_fast')return {id:'prompt',label:t('settings.promptFile')};
 if(props.engine==='pdf_math_precise')return {id:'custom_system_prompt',label:t('settings.systemPrompt')};
 return null;
});
const promptValue=computed(()=>props.advancedOptions?.[props.engine]?.[promptOption.value?.id]||'');
const schemaKey=computed(()=>`${props.engine}:${props.engineState?.version||''}:${props.catalogRevision}:${retry.value}`);

function serviceLabel(service){
 const keys={auto:'settings.translationServiceAuto',openai:'settings.translationServiceOpenAI','apple-local':'settings.translationServiceAppleLocal'};
 return keys[service.id]?t(keys[service.id]):service.label;
}
function fieldLabel(field){return field.required?`${field.label} *`:field.label;}
function fieldValue(field){
 if(field.secret)return props.credentials?.[props.engine]?.[selectedId.value]?.[field.id]||'';
 if(Object.prototype.hasOwnProperty.call(selectedProfileValues.value,field.id))return selectedProfileValues.value[field.id];
 return field.default===undefined?'':field.default;
}
function fieldValues(serviceId=selectedId.value){
 const profile=profiles.value[serviceId];
 if(profile?.values&&typeof profile.values==='object'&&!Array.isArray(profile.values))return profile.values;
 return serviceId===config.value.id&&config.value.values&&typeof config.value.values==='object'&&!Array.isArray(config.value.values)?config.value.values:{};
}
function nonSecretValues(service,raw){
 const values={};
 for(const field of service?.fields||[])if(!field.secret&&Object.prototype.hasOwnProperty.call(raw,field.id)){
  const value=raw[field.id];
  if(field.type==='boolean')values[field.id]=Boolean(value);
  else if(field.type==='number'||field.type==='integer'){
   const number=Number(value);if(Number.isFinite(number))values[field.id]=field.type==='integer'||field.integer===true?Math.trunc(number):number;
  }else if(typeof value==='string'&&value.length<=16384)values[field.id]=value;
 }
 return values;
}
function emitConfig(serviceId,rawValues={}){
 const next=cloneTranslationServices(props.modelValue);const current=next[props.engine]||{};const values=nonSecretValues(serviceById(serviceId),rawValues);
 const nextProfiles={...(current.profiles||{})};nextProfiles[serviceId]={values};
 next[props.engine]={id:serviceId,values,profiles:nextProfiles};
 emit('update:modelValue',next);emitRequest(serviceId,values);
}
function selectService(id){if(serviceById(id))emitConfig(id,fieldValues(id));}
function updateField(field,value){
 const values={...fieldValues(),[field.id]:value};
 if(value===''&&!field.required)delete values[field.id];
 emitConfig(selectedId.value,values);
}
function cloneCredentials(value){
 const result={};if(!value||typeof value!=='object'||Array.isArray(value))return result;
 for(const [engine,servicesValue] of Object.entries(value))if(servicesValue&&typeof servicesValue==='object'&&!Array.isArray(servicesValue)){
  result[engine]={};for(const [service,fields] of Object.entries(servicesValue))if(fields&&typeof fields==='object'&&!Array.isArray(fields))result[engine][service]={...fields};
 }
 return result;
}
function updateSecret(field,value){
 const next=cloneCredentials(props.credentials);const engineValues=next[props.engine]??={};const serviceValues=engineValues[selectedId.value]??={};
 if(value)serviceValues[field.id]=String(value);else delete serviceValues[field.id];
 if(!Object.keys(serviceValues).length)delete engineValues[selectedId.value];
 if(!Object.keys(engineValues).length)delete next[props.engine];
 emit('update:credentials',next);persistCredentials(selectedId.value,next[props.engine]?.[selectedId.value]||{});emitRequest(selectedId.value,fieldValues(selectedId.value),next);
}
function persistCredentials(service,values){
 const save=globalThis.window?.previewServiceCredentials?.save,engine=props.engine;if(typeof save!=='function')return;
 credentialWrites=credentialWrites.catch(()=>{}).then(()=>save({engine,service,values})).catch(error=>{if(generation)message.value=error.message||t('settings.translationServiceUnavailable');});
}
function requestValues(serviceId=selectedId.value,raw=fieldValues(serviceId),credentials=props.credentials){
 const service=serviceById(serviceId),secrets=credentials?.[props.engine]?.[serviceId]||{},values={};
 for(const field of service?.fields||[]){
  if(field.secret){if(typeof secrets[field.id]==='string'&&secrets[field.id])values[field.id]=secrets[field.id];}
  else if(Object.prototype.hasOwnProperty.call(raw,field.id))values[field.id]=raw[field.id];
  else if(field.default!==undefined)values[field.id]=field.default;
 }
 return values;
}
function emitRequest(serviceId=selectedId.value,rawValues=fieldValues(serviceId),credentials=props.credentials){
 const service=serviceById(serviceId),values=requestValues(serviceId,rawValues,credentials);
 if(!service){const secrets=credentials?.[props.engine]?.[serviceId]||{};emit('update:request',{engine:props.engine,id:serviceId,values:{...rawValues,...secrets}});return;}
 emit('update:request',{engine:props.engine,id:serviceId,values});
}
function updatePrompt(value){
 if(!promptOption.value)return;
 const next={...(props.advancedOptions?.[props.engine]||{})};if(value)next[promptOption.value.id]=value;else delete next[promptOption.value.id];
 emit('update:advancedOptions',{...props.advancedOptions,[props.engine]:next});
}
async function loadSchema(){
 const token=++generation;schema.value=null;message.value='';busy.value=true;
 try{const result=await loadTranslationServiceSchema(props.engine,props.engineState?.version||'');if(token!==generation)return;schema.value=result;message.value=result.reason||'';if(!result.reason&&result.services?.length&&!serviceById(config.value.id))emitConfig(result.services[0].id,fieldValues(result.services[0].id));else emitRequest();}
 catch(error){if(token===generation)message.value=error.message||t('settings.translationServiceUnavailable');}
 finally{if(token===generation)busy.value=false;}
}
watch(schemaKey,loadSchema,{immediate:true});
watch(()=>[selectedId.value,JSON.stringify(props.credentials?.[props.engine]||{}),JSON.stringify(selectedProfileValues.value)],()=>emitRequest(),{flush:'post'});
onBeforeUnmount(()=>{generation++;});
</script>

<template>
 <div class="translation-service-options">
  <div v-if="busy" class="translation-service-status muted" role="status">{{t('settings.translationServiceLoading')}}</div>
  <div v-if="services.length" class="setting-row translation-service-selector">
   <span id="translation-service-label">{{t('settings.translationService')}}</span>
   <MacPopUpButton :model-value="selectedId" teleport-to="body" aria-labelledby="translation-service-label" @update:model-value="selectService">
    <MacPopUpButtonItem v-for="service in services" :key="service.id" :value="service.id">{{serviceLabel(service)}}</MacPopUpButtonItem>
   </MacPopUpButton>
  </div>
  <p v-if="message" class="muted translation-service-message" role="status">{{message}} <MacButton v-if="!busy" size="small" @click="retry++">{{t('settings.translationServiceRetry')}}</MacButton></p>
  <div v-for="field in selectedService?.fields||[]" :key="field.id" class="translation-service-option" :data-service-field="field.id">
   <label :id="'translation-service-'+field.id">{{fieldLabel(field)}}</label>
   <MacSecureField v-if="field.secret" :model-value="String(fieldValue(field)??'')" autocomplete="off" autocapitalize="off" spellcheck="false" :aria-labelledby="'translation-service-'+field.id" @update:model-value="updateSecret(field,$event)"/>
   <MacSwitch v-else-if="field.type==='boolean'" :model-value="Boolean(fieldValue(field))" :aria-labelledby="'translation-service-'+field.id" @update:model-value="updateField(field,$event)"/>
   <MacPopUpButton v-else-if="field.choices?.length" :model-value="String(fieldValue(field)??'')" teleport-to="body" :aria-labelledby="'translation-service-'+field.id" @update:model-value="updateField(field,$event)"><MacPopUpButtonItem v-for="choice in field.choices" :key="String(choice)" :value="String(choice)">{{choice}}</MacPopUpButtonItem></MacPopUpButton>
   <MacTextField v-else :model-value="String(fieldValue(field)??'')" :type="field.type==='url'?'url':field.type==='number'||field.type==='integer'?'number':'text'" :min="field.min" :max="field.max" :step="field.type==='integer'||field.integer===true?1:'any'" :aria-labelledby="'translation-service-'+field.id" @update:model-value="updateField(field,$event)"/>
  </div>
  <div v-if="promptOption" class="translation-service-option prompt-option">
   <label :id="'service-'+promptOption.id">{{promptOption.label}}</label>
   <MacTextField :model-value="promptValue" :aria-labelledby="'service-'+promptOption.id" @update:model-value="updatePrompt"/>
  </div>
 </div>
</template>

<style scoped>
.translation-service-options{display:grid;gap:10px;}
.translation-service-status{margin-top:4px;}
.translation-service-message{display:flex;align-items:center;gap:8px;}
.translation-service-option{display:grid;gap:8px;}
.prompt-option{margin-top:4px;}
</style>
