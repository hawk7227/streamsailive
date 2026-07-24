import type { RuntimeOperation } from './contracts';
const ACTION_CLAIMS = /\b(?:built|created|saved|deployed|launched|opened|preview is ready|build is complete|files (?:were|have been) saved)\b/i;
export function validateExecutionClaims(text:string, operation:RuntimeOperation|null) {
 if (!ACTION_CLAIMS.test(text)) return {ok:true as const};
 const valid = operation?.status === 'completed' && operation.stage === 'COMPLETED' && Boolean(operation.previewId && operation.previewUrl) && operation.artifacts.some(a=>a.artifactType==='preview'&&a.status==='ready');
 return valid ? {ok:true as const} : {ok:false as const, reason:'UNGROUNDED_EXECUTION_CLAIM'};
}
