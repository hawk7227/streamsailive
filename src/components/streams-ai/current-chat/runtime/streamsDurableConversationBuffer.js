const PREFIX = 'streams-ai:conversation-buffer:';
export function readConversationBuffer(sessionId){
 if(typeof window==='undefined'||!sessionId)return [];
 try{const value=JSON.parse(window.localStorage.getItem(`${PREFIX}${sessionId}`)||'[]');return Array.isArray(value)?value:[];}catch{return [];}
}
export function writeConversationBuffer(sessionId,messages){
 if(typeof window==='undefined'||!sessionId)return;
 try{window.localStorage.setItem(`${PREFIX}${sessionId}`,JSON.stringify((Array.isArray(messages)?messages:[]).slice(-250)));}catch{}
}
export function mergeConversationMessages(localMessages,serverMessages){
 const byId=new Map();
 for(const item of [...(localMessages||[]),...(serverMessages||[])]){if(item?.id)byId.set(item.id,{...(byId.get(item.id)||{}),...item});}
 return [...byId.values()].sort((a,b)=>String(a.createdAt||'').localeCompare(String(b.createdAt||'')));
}
