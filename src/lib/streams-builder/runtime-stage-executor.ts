import { createHash } from "node:crypto";
import {
  checkpointStage,
  completeRuntime,
  consumeRuntimeCommand,
  failRuntime,
  heartbeatRuntime,
  nextPendingCommand,
  resumePoint,
  type DurableRuntimeRecord,
  type DurableRuntimeStore,
  type RuntimeStage,
} from "./durable-orchestrator";
import { diagnoseRepairFailure } from "./production-runtime-services";

export interface RuntimeStageResult {
  output: Record<string, unknown>;
  evidenceUris?: string[];
}

export interface RuntimeStageContext {
  runtime: DurableRuntimeRecord;
  stage: RuntimeStage;
  steering: Record<string, unknown>[];
  signal: AbortSignal;
}

export type RuntimeStageHandler = (context: RuntimeStageContext) => Promise<RuntimeStageResult>;

export interface RuntimeStageExecutorOptions {
  store: DurableRuntimeStore;
  runtimeId: string;
  ownerId: string;
  handlers: Partial<Record<RuntimeStage, RuntimeStageHandler>>;
  leaseTtlMs?: number;
  heartbeatIntervalMs?: number;
  maxRepairAttempts?: number;
  onProgress?: (event: { stage: RuntimeStage; status: string; message: string; runtime: DurableRuntimeRecord }) => Promise<void> | void;
}

const STAGE_ORDER: RuntimeStage[] = ["plan", "index", "patch", "verify", "browser", "deploy", "complete"];

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function emit(options: RuntimeStageExecutorOptions, runtime: DurableRuntimeRecord, status: string, message: string) {
  await options.onProgress?.({ stage: runtime.stage, status, message, runtime });
}

export async function executeDurableRuntime(options: RuntimeStageExecutorOptions): Promise<DurableRuntimeRecord> {
  const controller = new AbortController();
  const steering: Record<string, unknown>[] = [];
  const maxRepairAttempts = Math.max(0, Math.min(options.maxRepairAttempts ?? 3, 10));
  let runtime = await options.store.get(options.runtimeId);
  if (!runtime) throw new Error("Runtime not found.");
  if (!runtime.lease || runtime.lease.ownerId !== options.ownerId) throw new Error("Runtime must be claimed by this worker before execution.");

  const heartbeatEvery = Math.max(1_000, Math.min(options.heartbeatIntervalMs ?? 10_000, Math.max(1_000, (options.leaseTtlMs ?? 30_000) / 2)));
  const heartbeat = setInterval(() => {
    const heartbeatInput = {
      store: options.store,
      runtimeId: options.runtimeId,
      ownerId: options.ownerId,
      ...(options.leaseTtlMs !== undefined ? { ttlMs: options.leaseTtlMs } : {}),
    };
    void heartbeatRuntime(heartbeatInput)
      .then((next) => { runtime = next; })
      .catch(() => controller.abort("runtime heartbeat failed"));
  }, heartbeatEvery);

  try {
    const start = resumePoint(runtime).stage;
    const startIndex = Math.max(0, STAGE_ORDER.indexOf(start));

    for (let index = startIndex; index < STAGE_ORDER.length; index += 1) {
      const stage = STAGE_ORDER[index];
      if (!stage) break;
      runtime = await options.store.get(options.runtimeId) ?? runtime;
      if (runtime.status === "cancelled") return runtime;
      if (controller.signal.aborted) throw new Error(String(controller.signal.reason ?? "Runtime execution aborted."));

      let pending = nextPendingCommand(runtime);
      while (pending) {
        if (pending.type === "steer") steering.push(pending.payload ?? {});
        runtime = await consumeRuntimeCommand({ store: options.store, runtimeId: runtime.runtimeId, ownerId: options.ownerId, commandId: pending.id });
        await emit(options, runtime, `command.${pending.type}`, `Applied ${pending.type} command.`);
        if (runtime.status === "cancelled") return runtime;
        if (runtime.status === "paused") {
          await emit(options, runtime, "paused", "Runtime paused at a durable checkpoint boundary.");
          return runtime;
        }
        pending = nextPendingCommand(runtime);
      }

      if (stage === "complete") {
        runtime = await completeRuntime({ store: options.store, runtimeId: runtime.runtimeId, ownerId: options.ownerId });
        await emit(options, runtime, "completed", "Runtime completed with all required stages checkpointed.");
        return runtime;
      }

      const handler = options.handlers[stage];
      if (!handler) throw new Error(`No runtime handler is registered for required stage ${stage}.`);
      await emit(options, runtime, "started", `Starting ${stage} stage.`);

      let lastError: unknown = null;
      for (let attempt = 0; attempt <= maxRepairAttempts; attempt += 1) {
        try {
          const result = await handler({ runtime, stage, steering: [...steering], signal: controller.signal });
          runtime = await checkpointStage({
            store: options.store,
            runtimeId: runtime.runtimeId,
            ownerId: options.ownerId,
            stage,
            inputDigest: digest({ stage, steering, version: runtime.version }),
            output: result.output,
            ...(result.evidenceUris ? { evidenceUris: result.evidenceUris } : {}),
          });
          await emit(options, runtime, "checkpointed", `Completed ${stage} stage and persisted evidence.`);
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          const diagnostic = diagnoseRepairFailure({
            command: stage,
            stderr: error instanceof Error ? error.stack ?? error.message : String(error),
            priorFingerprints: runtime.checkpoints
              .flatMap((checkpoint) => Array.isArray(checkpoint.output.repairFingerprints) ? checkpoint.output.repairFingerprints : [])
              .filter((item): item is string => typeof item === "string"),
          });
          await emit(options, runtime, "repair", `Stage ${stage} failed: ${diagnostic.rootCause}`);
          if (!diagnostic.retryable || attempt >= maxRepairAttempts) break;
        }
      }

      if (lastError) {
        runtime = await failRuntime({
          store: options.store,
          runtimeId: runtime.runtimeId,
          ownerId: options.ownerId,
          message: lastError instanceof Error ? lastError.message : String(lastError),
          retryable: false,
        });
        await emit(options, runtime, "failed", `Runtime failed during ${stage}.`);
        return runtime;
      }
    }

    return runtime;
  } finally {
    clearInterval(heartbeat);
    controller.abort("runtime executor finished");
  }
}
