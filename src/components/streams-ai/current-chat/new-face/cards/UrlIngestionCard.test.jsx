import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import UrlIngestionCard from "./UrlIngestionCard";

describe("UrlIngestionCard", () => {
  it("shows unavailable transcript state truthfully", () => {
    render(
      <UrlIngestionCard
        item={{
          sourceType: "youtube",
          url: "https://youtu.be/a",
          metadataStatus: "complete",
          transcriptStatus: "unavailable",
        }}
      />
    );

    expect(screen.getByLabelText("URL ingestion card")).toBeInTheDocument();
    expect(screen.getByText("Reading YouTube link")).toBeInTheDocument();
    expect(screen.getByText("Transcript is not available from this link. Upload the video/audio file to analyze it directly.")).toBeInTheDocument();
  });

  it("shows normal URL ingestion state", () => {
    render(<UrlIngestionCard item={{ sourceType: "url", url: "https://example.com" }} />);

    expect(screen.getByText("Reading link")).toBeInTheDocument();
    expect(screen.getByText("Metadata: pending")).toBeInTheDocument();
  });
});
