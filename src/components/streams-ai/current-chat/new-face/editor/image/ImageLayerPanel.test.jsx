import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ImageLayerPanel from "./ImageLayerPanel";

describe("ImageLayerPanel", () => {
  it("renders asset layers and selection", () => {
    const onSelectLayer = vi.fn();

    render(
      <ImageLayerPanel
        asset={{ id: "asset_1", layers: [{ id: "layer_1", label: "Subject", type: "mask", status: "ready" }] }}
        selectedLayerId="layer_1"
        onSelectLayer={onSelectLayer}
      />
    );

    const layer = screen.getByText("Subject · mask · ready");
    expect(layer).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(layer);
    expect(onSelectLayer).toHaveBeenCalledWith("layer_1");
  });

  it("shows truthful missing analysis state", () => {
    render(<ImageLayerPanel asset={{ id: "asset_1" }} />);
    expect(screen.getByText("No image analysis saved yet.")).toBeInTheDocument();
  });
});
