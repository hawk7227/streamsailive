export interface CorrectionLoopPlan { maxAttempts: number; requiresOpenAIRepair: boolean; }
export const defaultCorrectionLoopPlan: CorrectionLoopPlan = { maxAttempts: 1, requiresOpenAIRepair: true };
