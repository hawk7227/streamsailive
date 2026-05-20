import { describe, expect, it } from "vitest";
import {
  buildImageEditorState,
  getBlockedImageEditorActions,
  getEnabledImageEditorActions,
  getImageEditorAction,
} from "./streamsImageEditorActions";

describe("streamsImageEditorActions", () => {
  it("returns prompt edit action metadata", () => {
    const action = getImageEditorAction("image_edit_prompt");

    expect(action.route).toBe("/api/streams/media/create");
    expect(action.output).toBe("image");
    expect(action.enabled).toBe(true);
  });

  it("keeps blocked actions with explicit reasons", () => {
    const blocked = getBlockedImageEditorActions();

    expect(blocked.length).toBeGreaterThan(0);
    expect(blocked.every((action) => action.blockedReason)).toBe(true);
  });

  it("returns enabled actions separately", () => {
    const enabled = getEnabledImageEditorActions();

    expect(enabled.map((action) => action.id)).toContain("image_to_video");
    expect(enabled.every((action) => action.enabled)).toBe(true);
  });

  it("builds editor state from an asset", () => {
    const state = buildImageEditorState({ id: "asset_1", kind: "image" });

    expect(state.asset.id).toBe("asset_1");
    expect(state.selectedTool).toBe("inspect");
    expect(state.actions.length).toBeGreaterThan(0);
  });
});
