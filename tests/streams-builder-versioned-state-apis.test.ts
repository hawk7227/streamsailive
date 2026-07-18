import { describe, expect, it } from "vitest";
import {
  appendBuilderCheckpoint,
  BUILDER_APPROVAL_STATUSES,
  filterBuilderEventsAfterSequence,
  normalizeBuilderEventCursor,
  VERSIONED_BUILDER_STATE_ROUTES,
} from "../src/lib/streams-builder/versioned-builder-api-contract";

describe("versioned builder state APIs", () => {
  it("publishes the durable workspace subresource routes", () => {
    expect(VERSIONED_BUILDER_STATE_ROUTES).toEqual([
      "/api/v1/builder/workspaces",
      "/api/v1/builder/drafts",
      "/api/v1/builder/checkpoints",
      "/api/v1/builder/patches",
      "/api/v1/builder/previews",
      "/api/v1/builder/approvals",
      "/api/v1/builder/events",
    ]);
    expect(BUILDER_APPROVAL_STATUSES).toEqual([
      "not_requested",
      "requested",
      "approved",
      "rejected",
    ]);
  });

  it("normalizes event cursors and restores only missed ordered events", () => {
    expect(normalizeBuilderEventCursor("4")).toBe(4);
    expect(normalizeBuilderEventCursor(-1)).toBeNull();
    expect(normalizeBuilderEventCursor("invalid")).toBeNull();

    const result = filterBuilderEventsAfterSequence([
      { id: "a", data: { sequenceNumber: 2 } },
      { id: "b", data: { sequenceNumber: 4 } },
      { id: "c", data: { sequenceNumber: 5 } },
    ], 3);
    expect(result.events.map((event) => event.id)).toEqual(["b", "c"]);
    expect(result.nextSequence).toBe(5);
  });

  it("deduplicates checkpoint ids and keeps the newest bounded history", () => {
    const result = appendBuilderCheckpoint(
      [{ id: "one" }, { id: "two" }, { id: "three" }],
      { id: "two", updated: true },
      3,
    );
    expect(result).toEqual([{ id: "one" }, { id: "three" }, { id: "two", updated: true }]);

    const bounded = appendBuilderCheckpoint(
      [{ id: "one" }, { id: "two" }, { id: "three" }],
      { id: "four" },
      3,
    );
    expect(bounded).toEqual([{ id: "two" }, { id: "three" }, { id: "four" }]);
  });
});
