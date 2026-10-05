import {createConnection} from 'node:net';
export function isProviderPortOpen(endpoint,{timeout=1000}={}){
 let url;try{url=new URL(endpoint);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)return Promise.resolve(false);}catch{return Promise.resolve(false);}
 return new Promise(resolve=>{
  const socket=createConnection({host:url.hostname.replace(/^\[|\]$/g,''),port:Number(url.port)||(url.protocol==='https:'?443:80)});
  const finish=open=>{socket.destroy();resolve(open);};
  socket.setTimeout(timeout);socket.once('connect',()=>finish(true));socket.once('error',()=>finish(false));socket.once('timeout',()=>finish(false));
 });
}
