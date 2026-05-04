import { PreCallDecision, RequestIntent } from './types';
const NO_SKIP = new Set<RequestIntent>(["build","debug","patch","file_analysis","unknown"]);
export function decidePreCall(intent: RequestIntent, text: string): PreCallDecision {
  const narrow = /\bonly\b.*\b(layout|interface|plan|inspect|shell|types?)\b/i.test(text);
  const tool = intent === 'tool_action' || /\b(open|show|list|download|copy|status)\b/i.test(text);
  const shouldCallModel = !(tool && !NO_SKIP.has(intent));
  return {shouldCallModel,providerCandidate:'openai',reason:shouldCallModel?'reasoning_required':'tool_first_safe',cacheEligible:intent==='normal_chat',responseCacheEligible:intent==='normal_chat',toolFirstEligible:tool,batchEligible:false,requiresFreshContext:shouldCallModel,requiresBuildMode:intent==='build'&&!narrow,maxInputContextTokens:intent==='build'?12000:3000,maxOutputTokens:intent==='build'?2500:900};
}
