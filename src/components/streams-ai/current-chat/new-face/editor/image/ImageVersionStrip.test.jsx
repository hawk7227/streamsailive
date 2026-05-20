import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ImageVersionStrip from "./ImageVersionStrip";

describe("ImageVersionStrip", () => {
  it("renders versions and selection", () => {
    const onSelectVersion = vi.fn();

    render(
      <ImageVersionStrip
        versions={[{ id: "v1", label: "Original", status: "saved" }]}
        selectedVersionId="v1"
        onSelectVersion={onSelectVersion}
      />
    );

    const version = screen.getByText("Original · saved");
    expect(version).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(version);
    expect(onSelectVersion).toHaveBeenCalledWith("v1");
  });

  it("renders current image fallback", () => {
    render(<ImageVersionStrip />);
    expect(screen.getByText("Current image · active")).toBeInTheDocument();
  });
});
