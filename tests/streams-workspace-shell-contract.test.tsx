import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/streams-builder/WorkspaceGrid", () => ({
  default: () => (
    <main data-testid="preserved-workspace-grid" data-layout="permanent-three-column">
      <section aria-label="Authoritative conversation" />
      <section aria-label="Code editor and frontend builder" />
      <section aria-label="Original visual editor" />
    </main>
  ),
}));

import ProjectWorkspaceShell from "../src/components/streams-workspace/ProjectWorkspaceShell";
import {
  PROJECT_CONTEXT_GROUPS,
  RIGHT_PANEL_SECTIONS,
  UNIVERSAL_BOTTOM_TRAY_ITEMS,
  CODING_BOTTOM_TRAY_EXTENSIONS,
  GLOBAL_NAVIGATION_ITEMS,
  UNIVERSAL_PROJECT_BAR_ITEMS,
  CANVAS_HEADER_ITEMS,
} from "../src/components/streams-workspace/preservation-contract";

const renderShell = () => renderToStaticMarkup(<ProjectWorkspaceShell />);

describe("universal project workspace shell", () => {
  it("mounts the preserved builder as the dominant surface", () => {
    const html = renderShell();
    expect(html).toContain('data-testid="preserved-workspace-grid"');
    expect(html).toContain('data-preserved-builder-surface="true"');
    expect(html).toContain('data-replacement-conversion="true"');
    expect(html).toContain('data-side-panels="removed"');
    expect(html).toContain('data-layout="permanent-three-column"');
    expect(html).toContain('aria-label="Authoritative conversation"');
    expect(html).toContain('aria-label="Code editor and frontend builder"');
    expect(html).toContain('aria-label="Original visual editor"');
    expect(html).toContain('aria-label="Workspace supporting materials"');
    expect(html).not.toContain('aria-label="StreamsAI global navigation"');
    expect(html).not.toContain('aria-label="Main workspace canvas"');
    expect(html).not.toContain('aria-label="Project context"');
    expect(html).not.toContain('aria-label="Contextual utility panel"');
  });

  it("does not expose permanent side-panel controls", () => {
    const html = renderShell();
    expect(html).not.toContain('aria-label="Toggle project context panel"');
    expect(html).not.toContain('aria-label="Toggle contextual utility panel"');
    expect(html).toContain('aria-label="Toggle bottom tray"');
  });

  it("retains the side-panel contracts for contextual reuse", () => {
    expect(PROJECT_CONTEXT_GROUPS.overview).toContain("Goal");
    expect(PROJECT_CONTEXT_GROUPS.filesAndInputs).toContain("Original prompt");
    expect(PROJECT_CONTEXT_GROUPS.memory).toContain("User decisions");
    expect(PROJECT_CONTEXT_GROUPS.codingStructure).toContain("Source truth");
    expect(Object.keys(RIGHT_PANEL_SECTIONS)).toEqual(["Properties", "Content", "Generate", "Project Guidance", "Ask AI"]);
  });

  it("retains navigation, top, canvas, and tray contracts", () => {
    expect(GLOBAL_NAVIGATION_ITEMS).toEqual(["Home", "Projects", "Workspace", "Files", "Create", "Generate", "Build", "Assets", "Tasks", "History", "Ask AI", "Settings"]);
    expect(UNIVERSAL_PROJECT_BAR_ITEMS).toEqual(["StreamsAI logo", "Project name", "Project type", "Save status", "Project status", "Version history", "Preview", "Share", "Export", "Publish or Complete", "User profile"]);
    expect(CANVAS_HEADER_ITEMS).toEqual(["Current output name", "View switcher", "Device preview", "Zoom", "Undo", "Redo", "Compare versions", "Full screen"]);
    expect([...UNIVERSAL_BOTTOM_TRAY_ITEMS, ...CODING_BOTTOM_TRAY_EXTENSIONS]).toEqual(["Assets", "Outputs", "Tasks", "Activity", "Versions", "Comments", "Console", "Logs", "Diff", "Proof", "Verification"]);
  });
});
