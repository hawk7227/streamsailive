import { describe, expect, it } from "vitest";
import {
  buildVideoEditorSelection,
  buildVideoEditorState,
  getBlockedVideoEditorActions,
  getEnabledVideoEditorActions,
  getVideoEditorAction,
} from "./streamsVideoEditorActions";

describe("streamsVideoEditorActions", () => {
  it("returns route-backed edit action metadata", () => {
    const action = getVideoEditorAction("video_change_motion");

    expect(action.route).toBe("/api/streams/video/edit-motion");
    expect(action.output).toBe("video");
    expect(action.enabled).toBe(true);
  });

  it("keeps blocked actions with explicit reasons", () => {
    const blocked = getBlockedVideoEditorActions();

    expect(blocked.map((action) => action.id)).toContain("video_lip_sync");
    expect(blocked.every((action) => action.blockedReason)).toBe(true);
  });

  it("returns enabled actions separately", () => {
    const enabled = getEnabledVideoEditorActions();

    expect(enabled.map((action) => action.id)).toContain("video_regenerate_shot");
    expect(enabled.every((action) => action.enabled)).toBe(true);
  });

  it("builds synchronized selection state", () => {
    const selection = buildVideoEditorSelection({
      type: "transcript",
      id: "word_1",
      startTime: 1.2,
      endTime: 2.4,
      trackType: "voice",
    });

    expect(selection.id).toBe("word_1");
    expect(selection.startTime).toBe(1.2);
    expect(selection.trackType).toBe("voice");
  });

  it("builds editor state from an asset", () => {
    const state = buildVideoEditorState({ id: "asset_1", kind: "video" });

    expect(state.asset.id).toBe("asset_1");
    expect(state.timelineZoom).toBe(1);
    expect(state.actions.length).toBeGreaterThan(0);
  });
});
