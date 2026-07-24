import { describe,it,expect } from 'vitest';
import { assertTransition,statusForStage } from '../../src/lib/streams-ai/runtime/architecture/state-machine';
import { allowedTools,assertToolAllowed } from '../../src/lib/streams-ai/runtime/architecture/tool-policy';
import { assembleRuntimeContext } from '../../src/lib/streams-ai/runtime/architecture/context-assembler';
import { normalizeFailure } from '../../src/lib/streams-ai/runtime/architecture/failure-taxonomy';
import { validateExecutionClaims } from '../../src/lib/streams-ai/runtime/architecture/response-claims';

describe('complete runtime foundation',()=>{
 it('enforces legal operation transitions',()=>{expect(()=>assertTransition('RECEIVED','FILES_WRITTEN')).toThrow(/INVALID_OPERATION_TRANSITION/);expect(()=>assertTransition('RECEIVED','REQUIREMENTS_RESOLVED')).not.toThrow();expect(statusForStage('COMPLETED')).toBe('completed');});
 it('forbids web search for website creation',()=>{expect(allowedTools('CREATE_WEBSITE')).not.toContain('web.search');expect(()=>assertToolAllowed('CREATE_WEBSITE','web.search')).toThrow(/TOOL_NOT_ALLOWED/);});
 it('assembles operation and failure context',()=>{const context=assembleRuntimeContext({sessionId:'s',capabilityVersion:'2',messages:[{role:'user',content:'build'}],lastOperation:{operationId:'o',sessionId:'s',turnId:'t',intent:'CREATE_WEBSITE',stage:'FAILED',status:'failed',idempotencyKey:'k',artifacts:[],failure:{code:'X',stage:'FAILED',safeMessage:'failed',retryable:true}}});expect(context.failureSummary).toBe('failed');expect(context.lastOperation?.operationId).toBe('o');});
 it('normalizes timeout failures',()=>{expect(normalizeFailure(new Error('STAGE_TIMEOUT:FILES_GENERATING'),'FILES_GENERATING').safeMessage).toMatch(/timed out/i);});
 it('rejects runtime claims without artifacts',()=>{expect(validateExecutionClaims('The build is complete and preview is ready.',null).ok).toBe(false);});
 it('accepts claims only with completed preview artifact',()=>{const operation:any={operationId:'o',sessionId:'s',turnId:'t',intent:'CREATE_WEBSITE',stage:'COMPLETED',status:'completed',idempotencyKey:'k',previewId:'p',previewUrl:'/p',artifacts:[{artifactId:'p',artifactType:'preview',status:'ready'}]};expect(validateExecutionClaims('The build is complete and preview is ready.',operation).ok).toBe(true);});
});
