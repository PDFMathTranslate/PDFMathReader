import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:net';
import {isProviderPortOpen} from './provider-port.mjs';
import {groupProviders,providerPortEndpoint} from '../src/provider-groups.mjs';
test('local providers are configured only while their selected endpoint port is open',async()=>{
 const server=createServer(socket=>socket.end());
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const endpoint=`http://127.0.0.1:${server.address().port}`;
 try{
  const services=[{id:'ollama',fields:[{id:'OLLAMA_HOST',default:'http://127.0.0.1:11434'}]},{id:'xinference',fields:[]}];
  const config={profiles:{ollama:{values:{OLLAMA_HOST:endpoint}}}};
  assert.equal(providerPortEndpoint(services[0],config),endpoint);
  assert.equal(groupProviders(services,config)[0].services.length,0);
  const open=await isProviderPortOpen(endpoint);assert.equal(open,true);
  assert.deepEqual(groupProviders(services,config,{}, {},{ollama:open})[0].services.map(item=>item.id),['ollama']);
 }finally{await new Promise(resolve=>server.close(resolve));}
 assert.equal(await isProviderPortOpen(endpoint),false);
 assert.equal(await isProviderPortOpen('invalid'),false);
 assert.equal(await isProviderPortOpen('file:///tmp/test'),false);
});
