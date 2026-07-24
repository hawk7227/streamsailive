import type { OperationStage, OperationStatus } from './contracts';

const transitions: Record<OperationStage, ReadonlySet<OperationStage>> = {
  RECEIVED: new Set(['REQUIREMENTS_RESOLVED','CANCELLED','FAILED']),
  REQUIREMENTS_RESOLVED: new Set(['PROJECT_CREATED','FILES_GENERATING','CANCELLED','FAILED']),
  PROJECT_CREATED: new Set(['FILES_GENERATING','CANCELLED','FAILED']),
  FILES_GENERATING: new Set(['FILES_WRITTEN','CANCELLED','FAILED']),
  FILES_WRITTEN: new Set(['BUILDING','BUILD_VALIDATING','CANCELLED','FAILED']),
  BUILDING: new Set(['BUILD_VALIDATING','CANCELLED','FAILED']),
  BUILD_VALIDATING: new Set(['PREVIEW_STARTING','CANCELLED','FAILED']),
  PREVIEW_STARTING: new Set(['PREVIEW_READY','CANCELLED','FAILED']),
  PREVIEW_READY: new Set(['COMPLETED','CANCELLED','FAILED']),
  COMPLETED: new Set(), FAILED: new Set(), CANCELLED: new Set(),
};

export function assertTransition(from: OperationStage, to: OperationStage) {
  if (from === to) return;
  if (!transitions[from]?.has(to)) throw new Error(`INVALID_OPERATION_TRANSITION:${from}:${to}`);
}
export function statusForStage(stage: OperationStage): OperationStatus {
  if (stage === 'COMPLETED') return 'completed';
  if (stage === 'FAILED') return 'failed';
  if (stage === 'CANCELLED') return 'cancelled';
  return stage === 'RECEIVED' ? 'queued' : 'running';
}
export const TERMINAL_STAGES = new Set<OperationStage>(['COMPLETED','FAILED','CANCELLED']);
