const inflight = new Map<string,string>();
export function fingerprint(parts:{taskId?:string;promptHash:string;contextHash:string;provider:string;model:string}){return `${parts.taskId??'na'}:${parts.promptHash}:${parts.contextHash}:${parts.provider}:${parts.model}`}
export function beginOrJoin(key:string){if(inflight.has(key)) return {duplicate:true,taskId:inflight.get(key)!}; inflight.set(key,key); return {duplicate:false,taskId:key};}
export function endCall(key:string){inflight.delete(key);}
