import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import VideoTimeline from "./VideoTimeline";

describe("VideoTimeline", () => {
  it("renders required timeline lanes", () => {
    render(<VideoTimeline selectedRange={{ type: "shot" }} />);

    expect(screen.getByLabelText("Video multi-lane timeline")).toBeInTheDocument();
    expect(screen.getByText("video / shots")).toBeInTheDocument();
    expect(screen.getByText("transcript phrases")).toBeInTheDocument();
    expect(screen.getByText("voice audio")).toBeInTheDocument();
    expect(screen.getByText("emotion")).toBeInTheDocument();
    expect(screen.getByText("motion")).toBeInTheDocument();
    expect(screen.getByText("lip-sync")).toBeInTheDocument();
  });

  it("selects lanes", () => {
    const onSelectLane = vi.fn();

    render(<VideoTimeline onSelectLane={onSelectLane} />);
    fireEvent.click(screen.getByText("voice audio"));

    expect(onSelectLane).toHaveBeenCalledWith("voice audio");
  });
});
