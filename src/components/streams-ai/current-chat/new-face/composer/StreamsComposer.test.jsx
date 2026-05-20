import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import StreamsComposer from "./StreamsComposer";

describe("StreamsComposer", () => {
  it("keeps URL and YouTube hidden until selected from the submenu", () => {
    render(<StreamsComposer />);

    expect(screen.queryByText("Read URL / YouTube")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Open tools"));
    fireEvent.click(screen.getByText("More ›"));

    expect(screen.getByText("Read URL / YouTube")).toBeInTheDocument();
  });

  it("switches into URL mode from the menu", () => {
    render(<StreamsComposer />);

    fireEvent.click(screen.getByLabelText("Open tools"));
    fireEvent.click(screen.getByText("More ›"));
    fireEvent.click(screen.getByText("Read URL / YouTube"));

    expect(screen.getByPlaceholderText("Paste a webpage, file link, or YouTube URL...")).toBeInTheDocument();
  });

  it("opens the model menu and defaults to Thinking with Auto provider", () => {
    render(<StreamsComposer />);

    expect(screen.getByLabelText("Open model menu")).toHaveTextContent("Thinking");

    fireEvent.click(screen.getByLabelText("Open model menu"));

    expect(screen.getByText("Auto")).toBeInTheDocument();
  });

  it("submits the message with mode and provider", () => {
    const onSubmit = vi.fn();

    render(<StreamsComposer onSubmit={onSubmit} />);

    fireEvent.change(screen.getByPlaceholderText("Ask anything"), {
      target: { value: "generate image" },
    });
    fireEvent.click(screen.getByLabelText("Send"));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      message: "generate image",
      composerMode: "chat",
      provider: "Auto",
      mode: "Thinking",
    }));
  });

  it("calls the file handler from the hidden file input", () => {
    const onFilesSelected = vi.fn();

    render(<StreamsComposer onFilesSelected={onFilesSelected} />);

    const file = new File(["x"], "image.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Add photos and files"), {
      target: { files: [file] },
    });

    expect(onFilesSelected).toHaveBeenCalledTimes(1);
    expect(onFilesSelected.mock.calls[0][0][0].name).toBe("image.png");
  });
});
