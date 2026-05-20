import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import IngestionStatusCard from "./IngestionStatusCard";

describe("IngestionStatusCard", () => {
  it("shows ingestion progress", () => {
    render(<IngestionStatusCard job={{ kind: "video", status: "processing", progress: 30 }} />);

    expect(screen.getByLabelText("Ingestion status card")).toBeInTheDocument();
    expect(screen.getByText("Reading video")).toBeInTheDocument();
    expect(screen.getByText("Progress: 30%")).toBeInTheDocument();
  });

  it("shows ingestion errors truthfully", () => {
    render(<IngestionStatusCard job={{ kind: "audio", status: "failed", error: "Transcription failed" }} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Transcription failed");
  });
});
