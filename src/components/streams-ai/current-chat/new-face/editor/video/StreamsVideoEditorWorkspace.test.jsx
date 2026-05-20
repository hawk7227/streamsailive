import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import StreamsVideoEditorWorkspace from "./StreamsVideoEditorWorkspace";

describe("StreamsVideoEditorWorkspace", () => {
  it("renders a first-class video intelligence workspace", () => {
    render(
      <StreamsVideoEditorWorkspace
        asset={{
          id: "video_1",
          kind: "video",
          name: "scene.mp4",
          duration: "5s",
          transcriptSegments: [{ id: "seg_1", text: "Hello", startTime: 1, endTime: 2 }],
        }}
      />
    );

    expect(screen.getByLabelText("Full video editor workspace")).toBeInTheDocument();
    expect(screen.getByLabelText("Video intelligence panel")).toBeInTheDocument();
    expect(screen.getByLabelText("Video preview canvas")).toBeInTheDocument();
    expect(screen.getByLabelText("Video inspector")).toBeInTheDocument();
    expect(screen.getByLabelText("Video multi-lane timeline")).toBeInTheDocument();
    expect(screen.getByText("Hello · 1s")).toBeInTheDocument();
  });

  it("synchronizes transcript selection and action selection", () => {
    const onAction = vi.fn();

    render(
      <StreamsVideoEditorWorkspace
        asset={{
          id: "video_1",
          kind: "video",
          transcriptSegments: [{ id: "seg_1", text: "Hello", startTime: 1, endTime: 2 }],
        }}
        onAction={onAction}
      />
    );

    fireEvent.click(screen.getByText("Hello · 1s"));
    expect(screen.getByText("Selected type: transcript")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Regenerate Shot"));
    expect(onAction).toHaveBeenCalledWith("video_regenerate_shot", expect.objectContaining({
      asset: expect.objectContaining({ id: "video_1" }),
    }));
  });
});
