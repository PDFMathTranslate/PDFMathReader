import {test} from 'node:test';
import assert from 'node:assert/strict';
import {groupProviders,isProviderConfigured} from '../src/provider-groups.mjs';
const services=[
 {id:'auto',fields:[]},
 {id:'openai',fields:[{id:'key',secret:true,required:true},{id:'model',required:true,default:'default-model'}]},
 {id:'local',fields:[{id:'url',type:'url',required:true,default:'http://localhost:11434'},{id:'workers',type:'integer',min:1,max:12,default:2}]}
];
test('provider groups distinguish complete credentials, incomplete profiles and recorded failures',()=>{
 const config={id:'auto',profiles:{openai:{values:{model:'saved-model'}}}};
 const credentials={openai:{key:'fixture-secret'}};
 const history={openai:{status:'error',updatedAt:1},local:{status:'success',updatedAt:2}};
 const grouped=groupProviders(services,config,credentials,history);
 assert.deepEqual(grouped.map(group=>[group.id,group.services.map(s=>s.id)]),[['configured',['auto','local']],['unconfigured',[]],['error',['openai']]]);
 history.openai.status='success';assert.deepEqual(groupProviders(services,config,credentials,history)[0].services.map(s=>s.id),['auto','openai','local']);
 assert.equal(groupProviders(services,config,{},history)[1].services[0].id,'openai');
 assert(!JSON.stringify(grouped).includes('fixture-secret'));
 assert.equal(groupProviders(services,config,credentials,{openai:{message:'No recorded status'}})[2].services.length,0);
});
test('configured provider validates required blanks, URLs, ranges, choices and false/zero values',()=>{
 assert.equal(isProviderConfigured(services[1],{}, {openai:{key:' '}}),false);
 for(const url of ['broken','ftp://example.test','https://user:password@example.test'])assert.equal(isProviderConfigured(services[2],{id:'local',values:{url}}),false);
 assert.equal(isProviderConfigured(services[2],{id:'local',values:{workers:0}}),false);
 assert.equal(isProviderConfigured(services[2],{id:'local',values:{workers:2.5}}),false);
 assert.equal(isProviderConfigured(services[2],{id:'local',values:{workers:13}}),false);
 const custom={id:'custom',fields:[{id:'mode',choices:['a','b'],required:true},{id:'enabled',type:'boolean',required:true},{id:'count',type:'integer',min:0,required:true}]};
 assert.equal(isProviderConfigured(custom,{id:'custom',values:{mode:'a',enabled:false,count:0}}),true);
 assert.equal(isProviderConfigured(custom,{id:'custom',values:{mode:'invalid',enabled:false,count:0}}),false);
});
test('groups preserve schema order, ignore other kernel records and partition each provider exactly once',()=>{
 const grouped=groupProviders(services,{},{} ,{pdf_math_precise:{openai:{status:'error'}}});
 assert.deepEqual(grouped.map(group=>group.services.map(s=>s.id)),[['auto','local'],['openai'],[]]);
 assert.deepEqual(grouped.flatMap(group=>group.services).sort((a,b)=>a.id.localeCompare(b.id)),[...services].sort((a,b)=>a.id.localeCompare(b.id)));
});
