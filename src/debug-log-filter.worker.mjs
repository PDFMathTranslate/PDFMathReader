import {filterDebugLogLines} from './debug-log-filter.mjs';
self.onmessage=({data})=>{
 try{self.postMessage({indices:filterDebugLogLines(data.lines,data.pattern)});}
 catch{self.postMessage({error:'invalid'});}
};
