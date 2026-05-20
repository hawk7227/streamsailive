import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ImageGenerationCard from "./ImageGenerationCard";

describe("ImageGenerationCard", () => {
  it("renders image size and actions", () => {
    const onAnimate = vi.fn();

    render(
      <ImageGenerationCard
        image={{ status: "ready", url: "https://x/image.png", width: 1024, height: 1024 }}
        onAnimate={onAnimate}
      />
    );

    expect(screen.getByLabelText("Image generation card")).toBeInTheDocument();
    expect(screen.getByText("1024 × 1024")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Animate"));
    expect(onAnimate).toHaveBeenCalledTimes(1);
  });

  it("renders generating state when no image URL exists", () => {
    render(<ImageGenerationCard image={{ status: "streaming", requestSizeLabel: "1024 × 1024" }} />);

    expect(screen.getByText("Generating image")).toBeInTheDocument();
    expect(screen.getByText("Generating image…")).toBeInTheDocument();
  });
});
