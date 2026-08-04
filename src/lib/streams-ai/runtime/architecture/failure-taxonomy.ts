import type { OperationFailure, OperationStage } from './contracts';

const KNOWN_CODE = /^[A-Z][A-Z0-9_]{3,}$/;

function extractCode(detail: string): string {
  const head = detail.split(':')[0].trim();
  if (KNOWN_CODE.test(head)) return head.slice(0, 120);

  const upper = detail.toUpperCase();
  if (/BEARER TOKEN|AUTHENTICAT|UNAUTHORIZED|401/.test(upper)) return 'AUTH_REQUIRED';
  if (/TIMEOUT|TIMED OUT|ETIMEDOUT|ABORTERROR|504/.test(upper)) return 'STAGE_TIMEOUT';
  if (/RATE LIMIT|429|QUOTA|INSUFFICIENT_QUOTA/.test(upper)) return 'RATE_LIMITED';
  if (/ECONNREFUSED|ENOTFOUND|FETCH FAILED|NETWORK/.test(upper)) return 'UPSTREAM_UNREACHABLE';
  if (/SUPABASE|PGRST|RELATION .* DOES NOT EXIST/.test(upper)) return 'DATABASE_ERROR';
  if (/OPENAI|MODEL .* DOES NOT EXIST|INVALID_API_KEY/.test(upper)) return 'MODEL_ERROR';
  if (/ABORT/.test(upper)) return 'REQUEST_ABORTED';
  return 'UNKNOWN_FAILURE';
}

export function normalizeFailure(error: unknown, stage: OperationStage): OperationFailure {
  const detail = error instanceof Error ? error.message : String(error);
  const code = extractCode(detail) || 'UNKNOWN_FAILURE';
  const retryable = !/NOT_ALLOWED|INVALID_OPERATION_TRANSITION|AUTH|FORBIDDEN|VALIDATION_PERMANENT/.test(code);

  const stageLabel = stage.toLowerCase().replaceAll('_', ' ');

  const safe =
    code === 'AUTH_REQUIRED' ? 'Your session is not authenticated. Sign in again and retry.' :
    code === 'STAGE_TIMEOUT' ? `The ${stageLabel} stage timed out.` :
    code === 'RATE_LIMITED' ? 'The AI provider rate limit or quota was reached.' :
    code === 'UPSTREAM_UNREACHABLE' ? 'An upstream service could not be reached.' :
    code === 'DATABASE_ERROR' ? 'The database rejected the request.' :
    code === 'MODEL_ERROR' ? 'The AI model request was rejected. Check the API key and model name.' :
    code.startsWith('STAGE_TIMEOUT') ? `The ${stageLabel} stage timed out.` :
    code.startsWith('PREVIEW_') ? 'The frontend was generated, but its preview could not be saved or started.' :
    code.startsWith('BUILDER_INVALID') ? 'The generated frontend did not pass validation.' :
    code === 'REQUEST_ABORTED' || code.startsWith('REQUEST_ABORTED') ? 'The operation was stopped before completion.' :
    `The ${stageLabel} stage failed: ${detail.slice(0, 300)}`;

  return {
    code,
    stage,
    safeMessage: `${safe} Your conversation and completed artifacts were preserved.`,
    retryable,
    detail: detail.slice(0, 2000),
  };
}

