import type { RuntimeOperation } from './contracts';
export function assertRetryAllowed(operation:RuntimeOperation & {retryCount?:number; retryBudget?:number}) {
 if (operation.status !== 'failed') throw new Error('RETRY_REQUIRES_FAILED_OPERATION');
 const count = operation.retryCount ?? Number(operation.metadata?.retryCount || 0);
 const budget = operation.retryBudget ?? Number(operation.metadata?.retryBudget || 2);
 if (count >= budget) throw new Error('RETRY_BUDGET_EXHAUSTED');
 return {nextRetryCount:count+1, retryBudget:budget};
}
