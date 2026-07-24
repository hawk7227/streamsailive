import type { OperationStage } from './contracts';
export const STAGE_TIMEOUT_MS: Record<OperationStage, number> = {
  RECEIVED: 5_000, REQUIREMENTS_RESOLVED: 15_000, PROJECT_CREATED: 20_000,
  FILES_GENERATING: 120_000, FILES_WRITTEN: 20_000, BUILDING: 180_000,
  BUILD_VALIDATING: 60_000, PREVIEW_STARTING: 60_000, PREVIEW_READY: 15_000,
  COMPLETED: 1, FAILED: 1, CANCELLED: 1,
};
export async function withStageTimeout<T>(stage: OperationStage, work: (signal: AbortSignal) => Promise<T>, parent?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`STAGE_TIMEOUT:${stage}`)), STAGE_TIMEOUT_MS[stage]);
  const abort = () => controller.abort(parent?.reason || new Error('REQUEST_ABORTED'));
  parent?.addEventListener('abort', abort, { once: true });
  try { return await work(controller.signal); }
  finally { clearTimeout(timeout); parent?.removeEventListener('abort', abort); }
}
