export type FalRunConfig = {
  model?: string;
  input?: Record<string, unknown>;
};

export type FalRunResult = {
  success: boolean;
  data: Record<string, unknown>;
};

export async function falRun(config: FalRunConfig): Promise<FalRunResult> {
  return {
    success: true,
    data: {
      model: config.model ?? null,
      input: config.input ?? {},
    },
  };
}
