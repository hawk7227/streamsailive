import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ImageInspectorPanel from "./ImageInspectorPanel";

describe("ImageInspectorPanel", () => {
  it("renders enabled and blocked image actions", () => {
    const onSelectAction = vi.fn();

    render(
      <ImageInspectorPanel
        selectedLayerId="layer_1"
        selectedActionId="image_to_video"
        onSelectAction={onSelectAction}
      />
    );

    expect(screen.getByText("Selected layer: layer_1")).toBeInTheDocument();
    expect(screen.getByText(/Animate Image/)).toHaveTextContent("selected");
    expect(screen.getByText(/Layer mask editing requires/)).toBeDisabled();

    fireEvent.click(screen.getByLabelText("Analyze"));
    expect(onSelectAction).toHaveBeenCalledWith("image_analyze");
  });
});
