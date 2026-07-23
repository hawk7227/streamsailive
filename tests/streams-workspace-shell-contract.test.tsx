import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/streams-builder/WorkspaceGrid", () => ({
  default: () => <div data-testid="preserved-workspace-grid">Preserved WorkspaceGrid</div>,
}));

import ProjectWorkspaceShell from "../src/components/streams-workspace/ProjectWorkspaceShell";
import { DEFAULT_WORKSPACE_STATE } from "../src/components/streams-workspace/workspace-state";
import {
  PROJECT_CONTEXT_GROUPS,
  RIGHT_PANEL_SECTIONS,
  UNIVERSAL_BOTTOM_TRAY_ITEMS,
  CODING_BOTTOM_TRAY_EXTENSIONS,
  GLOBAL_NAVIGATION_ITEMS,
  UNIVERSAL_PROJECT_BAR_ITEMS,
  CANVAS_HEADER_ITEMS,
} from "../src/components/streams-workspace/preservation-contract";

function renderShell() {
  return renderToStaticMarkup(<ProjectWorkspaceShell />);
}

describe("universal project workspace shell", () => {
  it("mounts the preserved builder and complete universal workspace surfaces", () => {
    const html = renderShell();
    expect(html).toContain('data-testid="preserved-workspace-grid"');
    expect(html).toContain('data-preserved-builder-surface="true"');
    expect(html).toContain('data-replacement-conversion="true"');
    expect(html).toContain('class="projectTopBar"');
    expect(html).toContain('aria-label="StreamsAI global navigation"');
    expect(html).toContain('aria-label="Project context"');
    expect(html).toContain('aria-label="Main workspace canvas"');
    expect(html).toContain('aria-label="Contextual utility panel"');
    expect(html).toContain('aria-label="Workspace supporting materials"');
  });

  it("opens both side panels by default while keeping collapse controls available", () => {
    const html = renderShell();
    expect(DEFAULT_WORKSPACE_STATE.projectPanelOpen).toBe(true);
    expect(DEFAULT_WORKSPACE_STATE.inspectorOpen).toBe(true);
    expect(html).toContain('aria-label="Toggle project context panel"');
    expect(html).toContain('aria-label="Toggle contextual utility panel"');
    expect(html).toContain('aria-label="Toggle bottom tray"');
  });

  it("retains the complete left project-context and right utility feature contracts", () => {
    expect(PROJECT_CONTEXT_GROUPS.overview).toEqual([
      "Project name", "Goal", "Audience", "Current status", "Project description", "Important instructions", "Brand or style preferences",
    ]);
    expect(PROJECT_CONTEXT_GROUPS.filesAndInputs).toEqual([
      "Documents", "Images", "Screenshots", "Videos", "Audio", "Spreadsheets", "Code files", "Links", "Notes", "Original prompt",
    ]);
    expect(PROJECT_CONTEXT_GROUPS.memory).toEqual([
      "User decisions", "Selected concepts", "Approved styles", "Rejected options", "Requirements", "Constraints", "Previous outputs",
    ]);
    expect(PROJECT_CONTEXT_GROUPS.codingStructure).toEqual([
      "Files", "Routes", "Components", "Data", "APIs", "Requirements", "Repository", "Source truth", "Checkpoints",
    ]);
    expect(Object.keys(RIGHT_PANEL_SECTIONS)).toEqual(["Properties", "Content", "Generate", "Project Guidance", "Ask AI"]);
    expect(RIGHT_PANEL_SECTIONS.Properties).toEqual(["Size", "Position", "Layout", "Typography", "Spacing", "Style", "Color", "Visibility", "Behavior"]);
    expect(RIGHT_PANEL_SECTIONS.Content).toEqual(["Title", "Description", "Button text", "Image", "Links", "Metadata"]);
    expect(RIGHT_PANEL_SECTIONS.Generate).toEqual(["Generate variation", "Replace", "Rewrite", "Expand", "Shorten", "Restyle", "Create alternatives"]);
    expect(RIGHT_PANEL_SECTIONS["Project Guidance"]).toEqual(["Missing items", "Recommended next steps", "Validation warnings", "Completion checklist"]);
  });

  it("retains the complete navigation, top controls, canvas controls, and work tray contracts", () => {
    expect(GLOBAL_NAVIGATION_ITEMS).toEqual(["Home", "Projects", "Workspace", "Files", "Create", "Generate", "Build", "Assets", "Tasks", "History", "Ask AI", "Settings"]);
    expect(UNIVERSAL_PROJECT_BAR_ITEMS).toEqual(["StreamsAI logo", "Project name", "Project type", "Save status", "Project status", "Version history", "Preview", "Share", "Export", "Publish or Complete", "User profile"]);
    expect(CANVAS_HEADER_ITEMS).toEqual(["Current output name", "View switcher", "Device preview", "Zoom", "Undo", "Redo", "Compare versions", "Full screen"]);
    expect([...UNIVERSAL_BOTTOM_TRAY_ITEMS, ...CODING_BOTTOM_TRAY_EXTENSIONS]).toEqual(["Assets", "Outputs", "Tasks", "Activity", "Versions", "Comments", "Console", "Logs", "Diff", "Proof", "Verification"]);
  });
});
