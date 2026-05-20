import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import StreamsChatCardRenderer from "./StreamsChatCardRenderer";

describe("StreamsChatCardRenderer", () => {
  it("renders image cards", () => {
    render(<StreamsChatCardRenderer card={{ type: "image_generation", image: { status: "ready", width: 1, height: 1 } }} />);

    expect(screen.getByLabelText("Image generation card")).toBeInTheDocument();
  });

  it("renders video cards", () => {
    render(<StreamsChatCardRenderer card={{ type: "video_generation", video: { status: "rendering" } }} />);

    expect(screen.getByLabelText("Video generation card")).toBeInTheDocument();
  });

  it("renders upload cards", () => {
    render(<StreamsChatCardRenderer card={{ type: "upload_progress", upload: { name: "file.png" } }} />);

    expect(screen.getByLabelText("Upload card")).toBeInTheDocument();
  });

  it("renders URL cards", () => {
    render(<StreamsChatCardRenderer card={{ type: "youtube_ingestion", item: { sourceType: "youtube" } }} />);

    expect(screen.getByLabelText("URL ingestion card")).toBeInTheDocument();
  });

  it("renders errors", () => {
    render(<StreamsChatCardRenderer card={{ type: "error", message: "Failed" }} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Failed");
  });
});
