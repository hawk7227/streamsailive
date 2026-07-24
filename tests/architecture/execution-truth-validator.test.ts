import { describe, expect, it } from "vitest";
import { assertExecutionClaimsGrounded } from "@/lib/streams-ai/runtime/architecture/execution-truth-validator";

const operation: any = { status: "completed", stage: "COMPLETED", previewId: "preview-1", previewUrl: "/streams-builder/preview/preview-1", artifacts: [{ artifactId: "preview-1", artifactType: "preview", status: "ready" }] };
describe("execution truth validator", () => {
  it("rejects ungrounded execution claims", () => expect(() => assertExecutionClaimsGrounded("The project has been saved and the preview is ready.", null)).toThrow("STREAMS_UNGROUNDED_EXECUTION_CLAIM"));
  it("accepts claims backed by completed artifacts", () => expect(() => assertExecutionClaimsGrounded("The project has been saved and the preview is ready.", operation)).not.toThrow());
});
