// Content-free, bounded per-document measurements. All times are monotonic milliseconds.
export function createPerformanceRecorder({native=globalThis.window?.previewPerformance,fetchStats=async()=>null,now=()=>performance.now()}={}){
 let report=null,start=0,scrollUntil=0,timer,observer,polling=false,generation=0,transportBase=null,active=true;
 const marks={};
 try{observer=new PerformanceObserver(list=>{if(!report)return;for(const entry of list.getEntries())if(scrollUntil>0&&entry.startTime+entry.duration>=start&&entry.startTime<=scrollUntil&&entry.startTime+entry.duration>=scrollUntil-1000){const tasks=report.scrollLongTasks;tasks.count++;tasks.totalMs+=entry.duration;tasks.maxMs=Math.max(tasks.maxMs,entry.duration);if(tasks.samples.length<40)tasks.samples.push({startMs:Math.max(0,entry.startTime-start),durationMs:entry.duration});}});observer.observe({type:'longtask',buffered:false});}catch{}
 async function sample(){if(polling||!report)return;polling=true;const token=generation;try{const memory=await native?.sample();if(token===generation&&memory)report.memory=memory;}catch{}finally{polling=false;}}
 async function snapshot(){if(!report)return null;await sample();try{const total=await fetchStats();if(total){report.transport={...total,scope:'since-document-open',timingScope:'window-session'};for(const key of ['requests','requestBodyBytes','responseBodyBytes','uploadBytes'])report.transport[key]=Math.max(0,total[key]-(transportBase?.[key]||0));}}catch{}return structuredClone(report);}
 function schedule(){clearInterval(timer);if(active&&report)timer=setInterval(sample,5000);}
 return {
  setActive(value){active=!!value;schedule();},
  async start(bytes){generation++;clearInterval(timer);start=now();scrollUntil=0;report={schemaVersion:1,openedAt:new Date().toISOString(),fileBytes:bytes,pageCount:0,firstScreenMs:null,stages:{},scrollLongTasks:{count:0,totalMs:0,maxMs:0,samples:[]},memory:null,transport:null,resize:{count:0,layoutCommits:0,snapshotTransitions:0}};for(const key of Object.keys(marks))delete marks[key];schedule();try{await native?.reset?.();transportBase=await fetchStats();}catch{transportBase=null;}void sample();},
  mark(name){if(report)report.stages[name]=now()-start;},
  pages(count){if(report)report.pageCount=count;},
  painted(){const token=generation;if(!report||report.firstScreenMs!==null||marks.paint)return;marks.paint=true;requestAnimationFrame(()=>requestAnimationFrame(()=>{if(token===generation&&report){report.firstScreenMs=now()-start;void snapshot().then(value=>native?.save(value)).catch(()=>{});}}));},
  scroll(){scrollUntil=now()+1000;},
  resize(name){if(report&&name in report.resize)report.resize[name]++;},
  snapshot,
  async finish(){const result=await snapshot();clearInterval(timer);if(result)try{await native?.save(result);}catch{}try{await native?.end?.();}catch{}return result;},
  destroy(){clearInterval(timer);observer?.disconnect();generation++;}
 };
}
