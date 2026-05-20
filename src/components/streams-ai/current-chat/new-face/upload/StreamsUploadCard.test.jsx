import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import StreamsUploadCard from "./StreamsUploadCard";

describe("StreamsUploadCard", () => {
  it("shows upload progress", () => {
    render(<StreamsUploadCard item={{ name: "video.mp4", status: "uploading", progress: 42 }} />);

    expect(screen.getByLabelText("Upload progress")).toBeInTheDocument();
    expect(screen.getByText("video.mp4")).toBeInTheDocument();
    expect(screen.getByText("Status: uploading")).toBeInTheDocument();
    expect(screen.getByText("42%")).toBeInTheDocument();
  });

  it("shows upload errors truthfully", () => {
    render(<StreamsUploadCard item={{ name: "bad.mov", status: "failed", progress: 10, error: "Upload failed" }} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Upload failed");
  });
});
