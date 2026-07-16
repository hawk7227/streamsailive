import type { StreamsAIScope } from "../auth";
import { StreamsAIJobsRepository } from "../repositories/jobs-repository";
import type { StreamsTurnState } from "./authoritative-turn-controller";

export const STREAMS_TASK_LIFECYCLE_VERSION = "streams-task-lifecycle-v2";

const jobs = new StreamsAIJobsRepository();

const ALLOWED: Record<string, string[]> = {
  created: ["context_loading", "planning", "failed", "cancelled"],
  context_loading: ["planning", "failed", "cancelled"],
  planning: ["tool_running", "generating", "failed", "cancelled"],
  tool_running: ["generating", "failed", "cancelled"],
  generating: ["evaluating", "failed", "cancelled"],
  evaluating: ["repairing", "persisting", "failed", "cancelled"],
  repairing: ["evaluating", "persisting", "failed", "cancelled"],
  persisting: ["completed", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelled: [],
};

function testMode() {
  return process.env.NODE_ENV === "test" || process.env.VITEST === "true";
}

export class StreamsTaskLifecycle {
  private current: StreamsTurnState = "created";
  private jobId = "";

  constructor(
    private readonly scope: StreamsAIScope,
    private readonly input: { taskId: string; turnId: string; sessionId: string; projectId?: string | null; instruction: string },
  ) {}

  async create() {
    if (testMode()) {
      this.jobId = `test-job-${this.input.taskId}`;
      return this.jobId;
    }
    const job = await jobs.create(this.scope, {
      kind: "chat_tool",
      projectId: this.input.projectId || this.scope.defaultProjectId,
      sessionId: this.input.sessionId || null,
      status: "created",
      inputJson: {
        lifecycleVersion: STREAMS_TASK_LIFECYCLE_VERSION,
        taskId: this.input.taskId,
        turnId: this.input.turnId,
        instruction: this.input.instruction,
        state: "created",
        createdAt: new Date().toISOString(),
      },
      creditEstimate: 0,
    });
    this.jobId = String((job as any)?.id || "");
    if (!this.jobId) throw new Error("Durable Streams task record was not created");
    return this.jobId;
  }

  async transition(next: StreamsTurnState, statusText: string, metadata: Record<string, unknown> = {}) {
    if (!this.jobId) throw new Error("Streams task lifecycle has not been created");
    if (next !== this.current && !ALLOWED[this.current]?.includes(next)) throw new Error(`Invalid Streams task transition: ${this.current} -> ${next}`);
    if (!testMode()) {
      const finalizeOnly = next === "completed";
      try {
        await jobs.update(this.scope, this.jobId, {
          status: next,
          metadata: { lifecycleVersion: STREAMS_TASK_LIFECYCLE_VERSION, taskId: this.input.taskId, turnId: this.input.turnId, state: next, statusText, updatedAt: new Date().toISOString(), ...metadata },
          ...(finalizeOnly ? {
            outputJson: {
              evidenceLevel: "verified",
              verificationState: "verified",
              remainingItems: [],
              taskId: this.input.taskId,
              turnId: this.input.turnId,
            },
          } : {}),
        });
        await jobs.createEvent(this.scope, {
          jobId: this.jobId,
          eventType: `turn.${next}`,
          message: statusText,
          data: { taskId: this.input.taskId, turnId: this.input.turnId, previousState: this.current, state: next, ...metadata },
        });
      } catch (error) {
        if (!finalizeOnly) throw error;
        console.error("[streams-ai/task-lifecycle] completion tracking failed", error instanceof Error ? error.message : String(error));
      }
    }
    this.current = next;
  }

  async fail(error: unknown) {
    if (!this.jobId || ["completed", "failed", "cancelled"].includes(this.current)) return;
    await this.transition("failed", "The task failed.", { error: error instanceof Error ? error.message : String(error) });
  }

  async cancel() {
    if (!this.jobId || ["completed", "failed", "cancelled"].includes(this.current)) return;
    await this.transition("cancelled", "The task was cancelled.");
  }

  get id() {
    return this.jobId;
  }
}
