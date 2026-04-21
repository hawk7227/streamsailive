/**
 * src/lib/assistant-core/timing.ts
 *
 * Structured turn timing for the assistant orchestrator.
 *
 * Every turn emits one TURN_TIMING log entry to stdout (Vercel function logs).
 * Fields are structured JSON so they can be queried in log aggregation.
 *
 * Checkpoints measured:
 *   context_ms     — buildContext() duration (file retrieval + embedding query)
 *   openai_ms      — time from responses.create() call to first text received
 *   total_ms       — full orchestrator execution from request to text sent
 *   tool_count     — number of tool loop iterations
 *   had_file_ctx   — whether file context was injected into the system prompt
 *   route          — resolved route (chat | image | video | build | file)
 *   model          — OpenAI model used
 *   msg_length     — character count of the user's message
 */

export type TurnTimingCheckpoint =
  | "request_received"
  | "context_built"
  | "openai_called"
  | "first_text_ready"
  | "turn_complete";

export class TurnTimer {
  private readonly turnId: string;
  private readonly startMs: number;
  private readonly marks: Partial<Record<TurnTimingCheckpoint, number>> = {};
  private meta: Record<string, unknown> = {};

  constructor(turnId: string) {
    this.turnId = turnId;
    this.startMs = performance.now();
    this.marks.request_received = 0;
  }

  mark(checkpoint: TurnTimingCheckpoint): void {
    this.marks[checkpoint] = performance.now() - this.startMs;
  }

  annotate(data: Record<string, unknown>): void {
    Object.assign(this.meta, data);
  }

  flush(): void {
    const now = performance.now() - this.startMs;
    const marks = this.marks;

    const context_ms = marks.context_built != null
      ? Math.round(marks.context_built - (marks.request_received ?? 0))
      : null;

    const openai_ms = marks.first_text_ready != null && marks.openai_called != null
      ? Math.round(marks.first_text_ready - marks.openai_called)
      : null;

    const total_ms = Math.round(marks.turn_complete ?? now);

    // PRD §8 target: first token <200ms.
    // openai_ms measures blocking time inside responses.create() — not
    // true first-token latency (which requires streaming mode).
    // Until streaming mode is enabled, openai_ms = total OpenAI round-trip.
    const metTarget = total_ms < 200;

    console.log(
      JSON.stringify({
        level: "info",
        event: "TURN_TIMING",
        turnId: this.turnId,
        context_ms,
        openai_ms,
        total_ms,
        met_200ms_target: metTarget,
        ...this.meta,
      }),
    );
  }
}
