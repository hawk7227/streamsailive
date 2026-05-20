import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import StreamsEditorSurface from "./StreamsEditorSurface";

describe("StreamsEditorSurface", () => {
  it("renders nothing without an asset", () => {
    const { container } = render(<StreamsEditorSurface asset={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders full image workspace for image assets", () => {
    render(<StreamsEditorSurface asset={{ kind: "image", name: "image.png" }} />);
    expect(screen.getByLabelText("Full image editor workspace")).toBeInTheDocument();
  });

  it("renders full video workspace for video assets", () => {
    render(<StreamsEditorSurface asset={{ kind: "video", name: "video.mp4" }} />);
    expect(screen.getByLabelText("Full video editor workspace")).toBeInTheDocument();
  });

  it("renders document editor for non-media assets", () => {
    render(<StreamsEditorSurface asset={{ kind: "document", name: "file.pdf" }} />);
    expect(screen.getByLabelText("Document editor panel")).toBeInTheDocument();
  });
});
