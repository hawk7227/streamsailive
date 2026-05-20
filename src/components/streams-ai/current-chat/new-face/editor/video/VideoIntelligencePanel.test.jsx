import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import VideoIntelligencePanel from "./VideoIntelligencePanel";

describe("VideoIntelligencePanel", () => {
  it("renders truthful missing track states", () => {
    render(<VideoIntelligencePanel asset={{}} />);

    expect(screen.getAllByText("No transcript yet").length).toBeGreaterThan(0);
    expect(screen.getByText("No motion track yet")).toBeInTheDocument();
    expect(screen.getByText("No emotion track yet")).toBeInTheDocument();
    expect(screen.getByText("No person profile yet")).toBeInTheDocument();
  });

  it("selects transcript ranges", () => {
    const onSelectRange = vi.fn();

    render(
      <VideoIntelligencePanel
        asset={{ transcriptSegments: [{ id: "seg_1", text: "Hello world", startTime: 1, endTime: 2 }] }}
        selectedRange={{ id: "seg_1" }}
        onSelectRange={onSelectRange}
      />
    );

    const segment = screen.getByText("Hello world · 1s");
    expect(segment).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(segment);
    expect(onSelectRange).toHaveBeenCalledWith(expect.objectContaining({
      id: "seg_1",
      trackType: "voice",
    }));
  });
});
