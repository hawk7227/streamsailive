import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import StreamsImageEditorWorkspace from "./StreamsImageEditorWorkspace";

describe("StreamsImageEditorWorkspace", () => {
  it("renders a first-class image editor workspace", () => {
    render(
      <StreamsImageEditorWorkspace
        asset={{
          id: "asset_1",
          kind: "image",
          name: "product.png",
          width: 1024,
          height: 1024,
          analysisSummary: "Product image",
        }}
      />
    );

    expect(screen.getByLabelText("Full image editor workspace")).toBeInTheDocument();
    expect(screen.getByLabelText("Image layers and analysis")).toBeInTheDocument();
    expect(screen.getByLabelText("Image editor canvas")).toBeInTheDocument();
    expect(screen.getByLabelText("Image inspector")).toBeInTheDocument();
    expect(screen.getByLabelText("Image version strip")).toBeInTheDocument();
    expect(screen.getByText("Product image")).toBeInTheDocument();
  });

  it("routes action selection through the shared action surface", () => {
    const onAction = vi.fn();

    render(<StreamsImageEditorWorkspace asset={{ id: "asset_1", kind: "image", name: "product.png" }} onAction={onAction} />);

    fireEvent.click(screen.getByLabelText("Animate Image"));

    expect(onAction).toHaveBeenCalledWith("image_to_video", expect.objectContaining({
      asset: expect.objectContaining({ id: "asset_1" }),
    }));
  });
});
