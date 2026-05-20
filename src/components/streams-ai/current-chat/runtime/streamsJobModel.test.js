import { describe, expect, it } from "vitest";
import { createJobRecord, jobIsTerminal } from "./streamsJobModel";

describe("streamsJobModel", () => {
  it("creates job records", () => {
    const job = createJobRecord({ id: "job_1", kind: "image_to_video" });
    expect(job.status).toBe("queued");
    expect(job.provider).toBe("auto");
  });

  it("detects terminal states", () => {
    expect(jobIsTerminal({ status: "complete" })).toBe(true);
    expect(jobIsTerminal({ status: "processing" })).toBe(false);
  });
});
