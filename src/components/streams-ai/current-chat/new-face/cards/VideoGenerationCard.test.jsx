import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import VideoGenerationCard from "./VideoGenerationCard";

describe("VideoGenerationCard", () => {
  it("renders provider, duration, and action controls", () => {
    const onViewScenes = vi.fn();

    render(
      <VideoGenerationCard
        video={{ status: "ready", provider: "Auto", duration: "5s" }}
        onViewScenes={onViewScenes}
      />
    );

    expect(screen.getByLabelText("Video generation card")).toBeInTheDocument();
    expect(screen.getByText("Provider: Auto")).toBeInTheDocument();
    expect(screen.getByText("Duration: 5s")).toBeInTheDocument();

    fireEvent.click(screen.getByText("View scenes"));
    expect(onViewScenes).toHaveBeenCalledTimes(1);
  });

  it("renders rendering state when no video URL exists", () => {
    render(<VideoGenerationCard video={{ status: "rendering" }} />);

    expect(screen.getByText("Generating video")).toBeInTheDocument();
    expect(screen.getByText("Rendering video…")).toBeInTheDocument();
  });
});
