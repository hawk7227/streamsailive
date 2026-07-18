import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/streams-builder/WorkspaceGrid", () => ({
  default: () => <div data-testid="preserved-workspace-grid">Preserved WorkspaceGrid</div>,
}));

import ProjectWorkspaceShell from "../src/components/streams-workspace/ProjectWorkspaceShell";

describe("universal project workspace shell", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("mounts the existing builder as the central preserved implementation", () => {
    render(<ProjectWorkspaceShell />);
    expect(screen.getByTestId("preserved-workspace-grid")).toBeTruthy();
    expect(document.querySelector('[data-preserved-builder-surface="true"]')).toBeTruthy();
    expect(document.querySelector('[data-replacement-conversion="true"]')).toBeTruthy();
  });

  it("renders the universal project identity and completion actions", () => {
    render(<ProjectWorkspaceShell />);
    expect(screen.getByText("Streams Builder")).toBeTruthy();
    expect(screen.getByText(/Coding \/ Application/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Preview" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Share" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Export" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Publish / Complete" })).toBeTruthy();
  });

  it("keeps the project—not Ask AI—as the dominant canvas", () => {
    render(<ProjectWorkspaceShell />);
    expect(screen.getByLabelText("Main workspace canvas")).toBeTruthy();
    expect(screen.getByLabelText("Project context")).toBeTruthy();
    expect(screen.getByLabelText("Contextual utility panel")).toBeTruthy();
    expect(screen.getByLabelText("Workspace supporting materials")).toBeTruthy();
  });

  it("renders the complete global navigation contract", () => {
    render(<ProjectWorkspaceShell />);
    const navigation = screen.getByLabelText("StreamsAI global navigation");
    for (const item of ["Home", "Projects", "Workspace", "Files", "Create", "Generate", "Build", "Assets", "Tasks", "History", "Ask AI", "Settings"]) {
      expect(navigation.querySelector(`[title="${item}"]`)).toBeTruthy();
    }
  });

  it("renders universal context, canvas, utility, and tray controls", () => {
    render(<ProjectWorkspaceShell />);
    expect(screen.getByText("Project Goal")).toBeTruthy();
    expect(screen.getByText("Current Stage")).toBeTruthy();
    expect(screen.getByText("Progress")).toBeTruthy();
    expect(screen.getByText("Next Recommended Action")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Full screen" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Properties" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Generate" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Ask AI" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Outputs" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Activity" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Proof" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Verification" })).toBeTruthy();
  });
});
