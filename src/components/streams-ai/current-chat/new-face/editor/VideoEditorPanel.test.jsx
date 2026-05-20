import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import VideoEditorPanel from "./VideoEditorPanel";

describe("VideoEditorPanel", () => {
  it("renders video metadata and actions", () => {
    const onExtractFrame = vi.fn();

    render(
      <VideoEditorPanel
        asset={{
          name: "video.mp4",
          duration: "5s",
          provider: "Auto",
          prompt: "Camera pushes in slowly",
        }}
        onExtractFrame={onExtractFrame}
      />
    );

    expect(screen.getByLabelText("Video editor panel")).toBeInTheDocument();
    expect(screen.getByText("Duration: 5s")).toBeInTheDocument();
    expect(screen.getByText("Provider: Auto")).toBeInTheDocument();
    expect(screen.getByText("Camera pushes in slowly")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Extract frame"));
    expect(onExtractFrame).toHaveBeenCalledTimes(1);
  });
});
