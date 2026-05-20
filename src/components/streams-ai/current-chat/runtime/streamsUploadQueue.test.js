import { describe, expect, it, vi } from "vitest";
import { createUploadQueue, runUploadItem, updateUploadItem } from "./streamsUploadQueue";

describe("streamsUploadQueue", () => {
  it("creates queued upload items", () => {
    const queue = createUploadQueue([{ name: "a.png", size: 10 }]);
    expect(queue[0].status).toBe("queued");
    expect(queue[0].progress).toBe(0);
  });

  it("updates one queue item", () => {
    const queue = createUploadQueue([{ name: "a.png", size: 10 }]);
    const next = updateUploadItem(queue, queue[0].id, { progress: 50 });
    expect(next[0].progress).toBe(50);
  });

  it("runs uploads through the provided uploader", async () => {
    const queue = createUploadQueue([{ name: "a.png", size: 10 }]);
    const updates = [];
    const uploader = vi.fn(async (_file, ctx) => {
      ctx.onProgress(30);
      ctx.onProgress(100);
      return { storagePath: "assets/a.png", storageUrl: "https://storage/a.png" };
    });

    const done = await runUploadItem(queue[0], uploader, (item) => updates.push(item));

    expect(uploader).toHaveBeenCalledTimes(1);
    expect(done.status).toBe("uploaded");
    expect(done.storagePath).toBe("assets/a.png");
    expect(updates.some((item) => item.progress === 30)).toBe(true);
  });
});
