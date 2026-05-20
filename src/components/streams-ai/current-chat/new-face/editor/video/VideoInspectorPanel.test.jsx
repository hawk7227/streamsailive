import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import VideoInspectorPanel from "./VideoInspectorPanel";

describe("VideoInspectorPanel", () => {
  it("renders enabled and blocked video actions", () => {
    const onSelectAction = vi.fn();

    render(
      <VideoInspectorPanel
        selectedRange={{ type: "shot", startTime: 2, endTime: 5 }}
        selectedActionId="video_regenerate_shot"
        onSelectAction={onSelectAction}
      />
    );

    expect(screen.getByText("Selected type: shot")).toBeInTheDocument();
    expect(screen.getByText("Selected range: 2s–5s")).toBeInTheDocument();
    expect(screen.getByText(/Regenerate Shot/)).toHaveTextContent("selected");
    expect(screen.getByText(/Lip sync requires/)).toBeDisabled();

    fireEvent.click(screen.getByLabelText("Change Motion"));
    expect(onSelectAction).toHaveBeenCalledWith("video_change_motion");
  });
});
