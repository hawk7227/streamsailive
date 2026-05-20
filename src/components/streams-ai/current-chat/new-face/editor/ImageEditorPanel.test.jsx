import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ImageEditorPanel from "./ImageEditorPanel";

describe("ImageEditorPanel", () => {
  it("renders image metadata and actions", () => {
    const onAnalyze = vi.fn();

    render(
      <ImageEditorPanel
        asset={{
          name: "image.png",
          width: 1024,
          height: 1024,
          source: "generated",
          prompt: "A studio product photo",
        }}
        onAnalyze={onAnalyze}
      />
    );

    expect(screen.getByLabelText("Image editor panel")).toBeInTheDocument();
    expect(screen.getByText("1024 × 1024")).toBeInTheDocument();
    expect(screen.getByText("Source: generated")).toBeInTheDocument();
    expect(screen.getByText("A studio product photo")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Analyze"));
    expect(onAnalyze).toHaveBeenCalledTimes(1);
  });

  it("shows pending size when dimensions are missing", () => {
    render(<ImageEditorPanel asset={{ name: "image.png" }} />);
    expect(screen.getByText("Size pending")).toBeInTheDocument();
  });
});
