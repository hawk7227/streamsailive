import type { OperationFailure, OperationStage } from './contracts';
export function normalizeFailure(error:unknown, stage:OperationStage):OperationFailure {
 const detail = error instanceof Error ? error.message : String(error);
 const code = detail.split(':')[0].slice(0,120) || 'UNKNOWN_FAILURE';
 const retryable = !/NOT_ALLOWED|INVALID_OPERATION_TRANSITION|AUTH|FORBIDDEN|VALIDATION_PERMANENT/.test(code);
 const safe = code.startsWith('STAGE_TIMEOUT') ? `The ${stage.toLowerCase().replaceAll('_',' ')} stage timed out.` :
  code.startsWith('PREVIEW_') ? 'The frontend was generated, but its preview could not be saved or started.' :
  code.startsWith('BUILDER_INVALID') ? 'The generated frontend did not pass validation.' :
  code.startsWith('REQUEST_ABORTED') ? 'The operation was stopped before completion.' : 'The frontend operation did not complete.';
 return { code, stage, safeMessage:`${safe} Your conversation and completed artifacts were preserved.`, retryable, detail:detail.slice(0,2000) };
}
