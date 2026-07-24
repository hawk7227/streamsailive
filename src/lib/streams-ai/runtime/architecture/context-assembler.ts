import type { RuntimeOperation } from './contracts';
export type ContextMessage = { role:'user'|'assistant'; content:string; status?:string; createdAt?:string };
export type RuntimeContext = { sessionId:string; messages:ContextMessage[]; lastOperation:RuntimeOperation|null; capabilityVersion:string; activeProjectId:string|null; activePreviewUrl:string|null; failureSummary:string|null };
export function assembleRuntimeContext(input:{sessionId:string; messages:ContextMessage[]; lastOperation?:RuntimeOperation|null; capabilityVersion:string}):RuntimeContext {
 const last = input.lastOperation || null;
 return { sessionId:input.sessionId, messages:input.messages.slice(-30), lastOperation:last, capabilityVersion:input.capabilityVersion,
  activeProjectId:last?.projectId || null, activePreviewUrl:last?.previewUrl || null, failureSummary:last?.failure?.safeMessage || null };
}
