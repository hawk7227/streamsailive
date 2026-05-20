import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ImageCanvas from "./ImageCanvas";

describe("ImageCanvas", () => {
  it("renders canvas metadata", () => {
    render(<ImageCanvas asset={{ width: 1536, height: 1024 }} zoom={1.5} compareMode="compare" />);

    expect(screen.getByLabelText("Image editor canvas")).toBeInTheDocument();
    expect(screen.getByText("Mode: compare")).toBeInTheDocument();
    expect(screen.getByText("Zoom: 150%")).toBeInTheDocument();
    expect(screen.getByText("1536 × 1024")).toBeInTheDocument();
  });

  it("shows truthful missing preview state", () => {
    render(<ImageCanvas asset={{}} />);
    expect(screen.getByText("No image preview available.")).toBeInTheDocument();
  });
});
