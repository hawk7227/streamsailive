import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DocumentEditorPanel from "./DocumentEditorPanel";

describe("DocumentEditorPanel", () => {
  it("renders document summary state", () => {
    render(
      <DocumentEditorPanel
        asset={{
          name: "file.pdf",
          kind: "document",
          summary: "Readable file",
          chunkCount: 12,
        }}
      />
    );

    expect(screen.getByLabelText("Document editor panel")).toBeInTheDocument();
    expect(screen.getByText("Readable file")).toBeInTheDocument();
    expect(screen.getByText("Chunks: 12")).toBeInTheDocument();
  });

  it("shows pending summary when no summary exists", () => {
    render(<DocumentEditorPanel asset={{ name: "file.pdf", kind: "document" }} />);
    expect(screen.getByText("Summary pending")).toBeInTheDocument();
  });
});
