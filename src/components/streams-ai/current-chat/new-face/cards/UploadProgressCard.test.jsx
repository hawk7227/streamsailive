import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import UploadProgressCard from "./UploadProgressCard";

describe("UploadProgressCard", () => {
  it("shows upload status", () => {
    render(<UploadProgressCard upload={{ name: "file.pdf", status: "uploaded", progress: 100 }} />);

    expect(screen.getByLabelText("Upload card")).toBeInTheDocument();
    expect(screen.getByText("file.pdf")).toBeInTheDocument();
    expect(screen.getByText("Progress: 100%")).toBeInTheDocument();
  });
});
