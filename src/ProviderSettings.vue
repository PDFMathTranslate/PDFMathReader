<script setup>
import {computed,ref,watch,onBeforeUnmount} from 'vue';
import {MacButton,MacPopUpButton,MacPopUpButtonItem,MacSecureField,MacSwitch,MacTextField} from './platform-controls.mjs';
import ProviderIcon from './ProviderIcon.vue';
import {groupProviders} from './provider-groups.mjs';
import {cloneTranslationServices,loadTranslationServiceSchema} from './translation-services.mjs';
import {t,uiLanguage} from './i18n.mjs';

const props=defineProps({
 engine:{type:String,default:''},
 engineState:{type:Object,default:null},
 catalogRevision:{type:Number,default:0},
 modelValue:{type:Object,default:()=>({})},
 advancedOptions:{type:Object,default:()=>({})},
 credentials:{type:Object,default:()=>({})},
 history:{type:Object,default:()=>({})}
});
const emit=defineEmits(['update:modelValue','update:advancedOptions','update:credentials','update:request']);

const schema=ref(null),busy=ref(false),message=ref(''),retry=ref(0),browseId=ref('');
let generation=0,credentialWrites=Promise.resolve();

const localLabels={
 en:{active:'Active',use:'Use provider',browseHint:'Editing a saved profile. Use this provider to make it active.',empty:'No providers are available for this kernel.',details:'Provider details',noDetails:'Select a provider to view its settings.'},
 'zh-CN':{active:'当前使用',use:'使用此提供商',browseHint:'正在编辑已保存的配置。使用此提供商可将其设为当前服务。',empty:'此内核没有可用的提供商。',details:'提供商详情',noDetails:'选择提供商以查看设置。'},
 'zh-TW':{active:'目前使用',use:'使用此提供者',browseHint:'正在編輯已儲存的設定。使用此提供者可將其設為目前服務。',empty:'此核心沒有可用的提供者。',details:'提供者詳細資料',noDetails:'選擇提供者以檢視設定。'},
 ja:{active:'使用中',use:'このプロバイダーを使う',browseHint:'保存済みの設定を編集中です。このプロバイダーを使うと現在のサービスになります。',empty:'このカーネルで利用できるプロバイダーはありません。',details:'プロバイダーの詳細',noDetails:'プロバイダーを選択すると設定を表示します。'},
 ko:{active:'사용 중',use:'이 제공업체 사용',browseHint:'저장된 프로필을 편집 중입니다. 이 제공업체를 사용하면 활성 서비스가 됩니다.',empty:'이 커널에서 사용할 수 있는 제공업체가 없습니다.',details:'제공업체 세부사항',noDetails:'제공업체를 선택하면 설정이 표시됩니다.'},
 fr:{active:'Actif',use:'Utiliser ce fournisseur',browseHint:'Profil enregistré en cours de modification. Utilisez ce fournisseur pour le rendre actif.',empty:'Aucun fournisseur disponible pour ce noyau.',details:'Détails du fournisseur',noDetails:'Sélectionnez un fournisseur pour afficher ses réglages.'},
 es:{active:'Activo',use:'Usar este proveedor',browseHint:'Editando un perfil guardado. Usa este proveedor para convertirlo en el servicio activo.',empty:'No hay proveedores disponibles para este núcleo.',details:'Detalles del proveedor',noDetails:'Selecciona un proveedor para ver sus ajustes.'}
};
function local(key){return localLabels[uiLanguage.value]?.[key]||localLabels.en[key];}

const config=computed(()=>{
 const value=props.modelValue?.[props.engine];
 return value&&typeof value==='object'&&!Array.isArray(value)?value:{};
});
const services=computed(()=>Array.isArray(schema.value?.services)?schema.value.services:[]);
const providerGroups=computed(()=>groupProviders(services.value,config.value,props.credentials?.[props.engine]||{},props.history?.[props.engine]||{}).filter(group=>group.id!=='error'||group.services.length>0));
const serviceById=id=>services.value.find(service=>service.id===id);
// Keep this active-service derivation in lockstep with TranslationServiceOptions.
const selectedId=computed(()=>typeof config.value.id==='string'&&message.value?config.value.id:serviceById(config.value.id)?.id||services.value[0]?.id||config.value.id||'auto');
const selectedProviderId=computed(()=>serviceById(browseId.value)?.id||selectedId.value);
const selectedService=computed(()=>serviceById(selectedProviderId.value));
const activeService=computed(()=>serviceById(selectedId.value));
const profiles=computed(()=>config.value.profiles&&typeof config.value.profiles==='object'&&!Array.isArray(config.value.profiles)?config.value.profiles:{});
function profileValuesFor(serviceId){
 const profile=profiles.value[serviceId];
 if(profile?.values&&typeof profile.values==='object'&&!Array.isArray(profile.values))return profile.values;
 if(serviceId===config.value.id&&config.value.values&&typeof config.value.values==='object'&&!Array.isArray(config.value.values))return config.value.values;
 return {};
}
const selectedProfileValues=computed(()=>profileValuesFor(selectedProviderId.value));
const activeProfileValues=computed(()=>profileValuesFor(selectedId.value));
const promptOption=computed(()=>{
 if(selectedProviderId.value==='apple-local'||selectedService.value?.supportsPrompt===false)return null;
 if(props.engine==='pdf_math_fast')return {id:'prompt',label:t('settings.promptFile')};
 if(props.engine==='pdf_math_precise')return {id:'custom_system_prompt',label:t('settings.systemPrompt')};
 return null;
});
const promptValue=computed(()=>props.advancedOptions?.[props.engine]?.[promptOption.value?.id]||'');
const schemaKey=computed(()=>`${props.engine}:${props.engineState?.version||''}:${props.catalogRevision}:${retry.value}`);
const accountVisible=computed(()=>selectedId.value==='auto'&&selectedProviderId.value==='auto');

function serviceLabel(service){
 const keys={auto:'settings.translationServiceAuto',openai:'settings.translationServiceOpenAI','apple-local':'settings.translationServiceAppleLocal','siliconflow-free':'settings.translationServiceSiliconFlowFree'};
 return keys[service.id]?t(keys[service.id]):service.label;
}
const noConfigurationNeeded=computed(()=>selectedService.value&&(selectedService.value.fields||[]).length===0);
const noConfigurationText=computed(()=>({en:'This service is ready to use without configuration.','zh-CN':'该服务无须配置即可使用。','zh-TW':'此服務無須設定即可使用。',ja:'このサービスは設定なしで使用できます。',ko:'이 서비스는 설정 없이 바로 사용할 수 있습니다.',fr:'Ce service peut être utilisé sans configuration.',es:'Este servicio se puede usar sin configuración.'})[uiLanguage.value]||'This service is ready to use without configuration.');
const freeThanks=computed(()=>({en:'Thank you to SiliconFlow for providing this free translation service. No API key is required.', 'zh-CN':'感谢硅基流动提供免费翻译服务。无需配置 API 密钥。','zh-TW':'感謝矽基流動提供免費翻譯服務。無需設定 API 金鑰。',ja:'無料翻訳サービスを提供する SiliconFlow に感謝します。API キーは不要です。',ko:'무료 번역 서비스를 제공하는 SiliconFlow에 감사드립니다. API 키가 필요하지 않습니다.',fr:'Merci à SiliconFlow pour ce service de traduction gratuit. Aucune clé API requise.',es:'Gracias a SiliconFlow por este servicio de traducción gratuito. No requiere clave API.'})[uiLanguage.value]||'Thank you to SiliconFlow for providing this free translation service. No API key is required.');
function fieldLabel(field){return field.required?`${field.label} *`:field.label;}
function fieldValue(field,serviceId=selectedProviderId.value){
 if(field.secret)return props.credentials?.[props.engine]?.[serviceId]?.[field.id]||'';
 const values=profileValuesFor(serviceId);
 if(Object.prototype.hasOwnProperty.call(values,field.id))return values[field.id];
 return field.default===undefined?'':field.default;
}
function fieldValues(serviceId=selectedProviderId.value){return profileValuesFor(serviceId);}
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
function emitConfig(serviceId,rawValues={},activate=true){
 const next=cloneTranslationServices(props.modelValue);const current=next[props.engine]||{};const values=nonSecretValues(serviceById(serviceId),rawValues);
 const nextProfiles={...(current.profiles||{})};nextProfiles[serviceId]={values};
 const nextConfig={...current,profiles:nextProfiles};
 if(activate||typeof current.id!=='string'){
  nextConfig.id=serviceId;nextConfig.values=values;
 }
 next[props.engine]=nextConfig;
 emit('update:modelValue',next);
 if(activate)emitRequest(serviceId,values);
 else emitRequest(selectedId.value,fieldValues(selectedId.value));
}
function browseService(id){if(serviceById(id))browseId.value=id;}
function useService(id=selectedProviderId.value){if(!serviceById(id))return;browseId.value=id;emitConfig(id,fieldValues(id),true);}
function updateField(field,value){
 const serviceId=selectedProviderId.value;const values={...fieldValues(serviceId),[field.id]:value};
 if(value===''&&!field.required)delete values[field.id];
 emitConfig(serviceId,values,serviceId===selectedId.value);
}
function cloneCredentials(value){
 const result={};if(!value||typeof value!=='object'||Array.isArray(value))return result;
 for(const [engine,servicesValue] of Object.entries(value))if(servicesValue&&typeof servicesValue==='object'&&!Array.isArray(servicesValue)){
  result[engine]={};for(const [service,fields] of Object.entries(servicesValue))if(fields&&typeof fields==='object'&&!Array.isArray(fields))result[engine][service]={...fields};
 }
 return result;
}
function updateSecret(field,value){
 const serviceId=selectedProviderId.value;const next=cloneCredentials(props.credentials);const engineValues=next[props.engine]??={};const serviceValues=engineValues[serviceId]??={};
 if(value)serviceValues[field.id]=String(value);else delete serviceValues[field.id];
 if(!Object.keys(serviceValues).length)delete engineValues[serviceId];
 if(!Object.keys(engineValues).length)delete next[props.engine];
 emit('update:credentials',next);persistCredentials(serviceId,next[props.engine]?.[serviceId]||{});
 emitRequest(selectedId.value,fieldValues(selectedId.value),next);
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
watch([selectedId,services],()=>{if(!serviceById(browseId.value))browseId.value=serviceById(selectedId.value)?.id||'';},{flush:'post'});
watch(()=>[selectedId.value,JSON.stringify(props.credentials?.[props.engine]||{}),JSON.stringify(activeProfileValues.value)],()=>emitRequest(),{flush:'post'});
const scrollbarTimers=new Map();
function revealScrollbar(event){const target=event.currentTarget;target.dataset.scrolling='true';clearTimeout(scrollbarTimers.get(target));scrollbarTimers.set(target,setTimeout(()=>{delete target.dataset.scrolling;scrollbarTimers.delete(target);},800));}
onBeforeUnmount(()=>{generation++;for(const timer of scrollbarTimers.values())clearTimeout(timer);scrollbarTimers.clear();});
</script>

<template>
 <div class="provider-settings" :aria-busy="busy">
  <aside class="provider-browser" :aria-label="t('settings.translationService')">
   <div class="provider-list" @scroll.passive="revealScrollbar">
   <section v-for="group in providerGroups" :key="group.id" class="provider-group" :data-provider-group="group.id" :aria-labelledby="'provider-group-'+group.id">
    <h3 :id="'provider-group-'+group.id" class="provider-group-title">{{t('settings.providerGroups.'+group.id)}} <span>{{group.services.length}}</span></h3>
    <div v-if="group.services.length" role="listbox" :aria-label="t('settings.providerGroups.'+group.id)">
    <button v-for="service in group.services" :key="service.id" type="button" role="option" class="provider-list-item" :data-provider-id="service.id" :class="{'is-browse':service.id===selectedProviderId,'is-active':service.id===selectedId}" :aria-selected="service.id===selectedProviderId" :aria-current="service.id===selectedId?'true':undefined" @click="browseService(service.id)">
     <ProviderIcon :provider="service" :label="serviceLabel(service)"/>
     <span class="provider-list-copy"><span class="provider-list-name" :title="serviceLabel(service)">{{serviceLabel(service)}}</span><span v-if="service.id===selectedId" class="provider-active-label">{{local('active')}}</span></span>
     <span v-if="service.id===selectedProviderId" class="provider-selection-dot" aria-hidden="true"></span>
    </button>
    </div>
    <p v-else class="muted provider-group-empty">{{t('settings.providerGroups.empty')}}</p>
   </section>
   </div>
   <p v-if="!services.length&&!busy" class="muted provider-empty" role="status">{{local('empty')}}</p>
  </aside>
  <section class="provider-detail" :aria-label="local('details')">
   <div class="provider-detail-content" @scroll.passive="revealScrollbar">
   <p v-if="busy" class="muted provider-status" role="status">{{t('settings.translationServiceLoading')}}</p>
   <p v-if="message" class="muted provider-status" role="status">{{message}} <MacButton v-if="!busy" size="small" @click="retry++">{{t('settings.translationServiceRetry')}}</MacButton></p>
   <p v-if="noConfigurationNeeded" class="muted provider-no-configuration">{{noConfigurationText}}</p>
   <div v-if="accountVisible&&$slots.account" class="provider-account"><slot name="account"/></div>
   <div v-if="selectedProviderId==='siliconflow-free'" class="provider-free-thanks"><p>{{freeThanks}}</p><a href="https://siliconflow.cn/" target="_blank" rel="noopener noreferrer">SiliconFlow ↗</a></div>
   <div v-if="selectedService" class="provider-fields">
    <div v-for="field in selectedService.fields||[]" :key="field.id" class="provider-field" :data-service-field="field.id">
     <label :id="'provider-field-'+field.id">{{fieldLabel(field)}}</label>
     <MacSecureField v-if="field.secret" :model-value="String(fieldValue(field)??'')" autocomplete="off" autocapitalize="off" spellcheck="false" :aria-labelledby="'provider-field-'+field.id" @update:model-value="updateSecret(field,$event)"/>
     <MacSwitch v-else-if="field.type==='boolean'" :model-value="Boolean(fieldValue(field))" :aria-labelledby="'provider-field-'+field.id" @update:model-value="updateField(field,$event)"/>
     <MacPopUpButton v-else-if="field.choices?.length" :model-value="String(fieldValue(field)??'')" teleport-to="body" :aria-labelledby="'provider-field-'+field.id" @update:model-value="updateField(field,$event)"><MacPopUpButtonItem v-for="choice in field.choices" :key="String(choice)" :value="String(choice)">{{choice}}</MacPopUpButtonItem></MacPopUpButton>
     <MacTextField v-else :model-value="String(fieldValue(field)??'')" :type="field.type==='url'?'url':field.type==='number'||field.type==='integer'?'number':'text'" :min="field.min" :max="field.max" :step="field.type==='integer'||field.integer===true?1:'any'" :aria-labelledby="'provider-field-'+field.id" @update:model-value="updateField(field,$event)"/>
    </div>
    <div v-if="promptOption" class="provider-field prompt-option">
     <label :id="'provider-field-'+promptOption.id">{{promptOption.label}}</label>
     <MacTextField :model-value="promptValue" :aria-labelledby="'provider-field-'+promptOption.id" @update:model-value="updatePrompt"/>
    </div>
   </div>
   <div v-else-if="!accountVisible" class="provider-no-details"><p class="muted">{{local('noDetails')}}</p></div>
   </div>
   <footer v-if="selectedService&&selectedProviderId!==selectedId" class="provider-detail-actions"><MacButton class="provider-use-button" variant="prominent" @click="useService()">{{local('use')}}</MacButton></footer>
  </section>
 </div>
</template>

<style scoped>
.provider-free-thanks{font-size:13px;line-height:1.6;color:var(--text-secondary)}
.provider-free-thanks p{margin:0 0 12px}.provider-free-thanks a{color:var(--accent)}
.provider-settings{display:grid;grid-template-columns:max-content minmax(0,1fr);grid-template-rows:minmax(0,1fr);gap:0;width:100%;height:100%;min-height:0;min-width:0;color:var(--text)}
:is(.provider-list,.provider-detail-content){scrollbar-width:thin;scrollbar-color:transparent transparent;}
:is(.provider-list,.provider-detail-content)[data-scrolling]{scrollbar-color:var(--text-tertiary) transparent;}
:is(.provider-list,.provider-detail-content)::-webkit-scrollbar{width:6px;height:6px;}
:is(.provider-list,.provider-detail-content)::-webkit-scrollbar-track{background:transparent;}
:is(.provider-list,.provider-detail-content)::-webkit-scrollbar-thumb{background:transparent;border-radius:999px;}
:is(.provider-list,.provider-detail-content)[data-scrolling]::-webkit-scrollbar-thumb{background:var(--text-tertiary);}
.provider-browser,.provider-detail{box-sizing:border-box;min-width:0;min-height:0}
.provider-browser{min-width:190px;overflow:hidden;padding:18px 12px;background:var(--paper);display:grid;align-content:start;grid-template-rows:minmax(0,1fr) auto;gap:9px}
.provider-browser-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0}
.provider-browser-heading h3,.provider-detail-heading h3{margin:0;color:var(--text);font-size:14px;font-weight:600;line-height:1.35;letter-spacing:-.01em}
.provider-count{display:inline-grid;place-items:center;min-width:22px;height:20px;padding:0 6px;border:1px solid var(--chrome-border);border-radius:999px;color:var(--text-secondary);background:var(--chrome-raised);font-size:11px;font-weight:600}
.provider-list{display:grid;align-content:start;gap:3px;min-height:0;max-height:none;padding:2px;overflow:auto;overscroll-behavior:contain;scrollbar-width:thin}
.provider-group{min-width:0;}
.provider-group + .provider-group{margin-top:14px;padding-top:12px;border-top:1px solid var(--chrome-divider);}
.provider-group-title{display:flex;justify-content:space-between;gap:8px;margin:0 6px 8px;color:var(--text-secondary);font-size:12px;font-weight:600;}
.provider-group-title span{font-weight:400;}
.provider-group-empty{margin:0 6px;font-size:11px;}
.provider-group[data-provider-group=error] .provider-group-title{color:var(--danger,#c93434);}
.provider-list-item{display:grid;grid-template-columns:28px minmax(0,1fr) 8px;align-items:center;gap:9px;width:100%;min-width:0;padding:8px 8px;color:var(--text-secondary);background:transparent;border:1px solid transparent;border-radius:var(--radius-sm);text-align:left;font-size:13px;line-height:1.25;transition:background-color var(--motion-duration) var(--motion-ease),border-color var(--motion-duration) var(--motion-ease),color var(--motion-duration) var(--motion-ease)}
.provider-list-item:hover{color:var(--text);background:var(--chrome-hover)}
.provider-list-item:active{background:var(--chrome-pressed)}
.provider-list-item.is-browse{color:var(--text);background:var(--accent-soft);border-color:color-mix(in srgb,var(--accent) 22%,transparent)}
.provider-list-item.is-active:not(.is-browse){border-color:var(--chrome-border)}
.provider-list-copy{display:grid;gap:6px;min-width:0}
.provider-list-name{min-width:0;white-space:nowrap;font-weight:500}
.provider-active-label{overflow:hidden;color:var(--accent);font-size:11px;text-overflow:ellipsis;white-space:nowrap}
.provider-selection-dot{width:6px;height:6px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
.provider-empty,.provider-status,.provider-browse-hint{margin:0;color:var(--text-secondary);font-size:12px;line-height:1.45}
.provider-detail{display:flex;flex-direction:column;gap:13px;min-height:0;padding:22px 24px;overflow:hidden;border-left:1px solid var(--chrome-divider)}
.provider-detail-content{display:grid;align-content:start;gap:13px;flex:1;min-height:0;overflow:auto;}
.provider-detail-actions{display:flex;flex:none;justify-content:flex-end;padding-top:12px;}
.provider-detail-heading{display:grid;grid-template-columns:34px minmax(0,1fr) auto;align-items:center;gap:10px;min-width:0}
.provider-detail-title{display:grid;gap:2px;min-width:0}
.provider-detail-title h3{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.provider-detail-id{overflow:hidden;color:var(--text-tertiary);font-size:11px;text-overflow:ellipsis;white-space:nowrap}
.provider-detail-heading :deep(button){white-space:nowrap}
.provider-active-badge{padding:3px 7px;border:1px solid color-mix(in srgb,var(--accent) 20%,transparent);border-radius:999px;color:var(--accent);background:var(--accent-soft);font-size:11px;font-weight:600;white-space:nowrap}
.provider-account{padding:10px 12px;border:1px solid var(--chrome-border);border-radius:var(--radius-sm);background:var(--chrome-softer,var(--accent-softer))}
.provider-fields{display:grid;gap:14px;min-width:0}
.provider-field{display:grid;gap:7px;min-width:0}
.provider-field>label{display:block;margin:0;color:var(--text);font-size:12px;font-weight:500}
.provider-field :deep(mac-text-field),.provider-field :deep(mac-secure-field),.provider-field :deep(.macvue-field){width:100%;min-width:0}
.prompt-option{margin-top:3px;padding-top:14px;border-top:1px solid var(--chrome-divider)}
.provider-no-details{padding:12px 0}
@media(max-width:700px){
 .provider-settings{display:flex;flex-direction:column;gap:0;overflow:auto}
 .provider-browser{flex:none;max-height:245px}
 .provider-list{max-height:150px}
 .provider-detail{flex:none;overflow:visible;padding:20px 16px;border-top:1px solid var(--chrome-divider);border-left:0}
}
@media(prefers-reduced-motion:reduce){.provider-list-item{transition:none}}
</style>
