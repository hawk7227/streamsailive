import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import StreamsDropOverlay from "./StreamsDropOverlay";

describe("StreamsDropOverlay", () => {
  it("does not render when inactive", () => {
    render(<StreamsDropOverlay active={false} />);
    expect(screen.queryByLabelText("Drop files to upload")).not.toBeInTheDocument();
  });

  it("renders the drop overlay when active", () => {
    render(<StreamsDropOverlay active />);
    expect(screen.getByLabelText("Drop files to upload")).toBeInTheDocument();
    expect(screen.getByText("Drop files to upload")).toBeInTheDocument();
  });
});
