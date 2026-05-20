import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import VideoPreviewCanvas from "./VideoPreviewCanvas";

describe("VideoPreviewCanvas", () => {
  it("renders preview selection state", () => {
    render(<VideoPreviewCanvas selectedRange={{ type: "shot", startTime: 1, endTime: 4 }} compareMode="compare" />);

    expect(screen.getByLabelText("Video preview canvas")).toBeInTheDocument();
    expect(screen.getByText("Compare: compare")).toBeInTheDocument();
    expect(screen.getByText("Selection: shot 1s–4s")).toBeInTheDocument();
  });

  it("shows truthful missing preview state", () => {
    render(<VideoPreviewCanvas asset={{}} />);
    expect(screen.getByText("No video preview available.")).toBeInTheDocument();
  });
});
