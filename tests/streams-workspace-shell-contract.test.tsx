import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/streams-builder/WorkspaceGrid", () => ({
  default: () => <div data-testid="preserved-workspace-grid">Preserved WorkspaceGrid</div>,
}));

import ProjectWorkspaceShell from "../src/components/streams-workspace/ProjectWorkspaceShell";
import { DEFAULT_WORKSPACE_STATE } from "../src/components/streams-workspace/workspace-state";
import { PROJECT_CONTEXT_GROUPS, RIGHT_PANEL_SECTIONS, UNIVERSAL_BOTTOM_TRAY_ITEMS, CODING_BOTTOM_TRAY_EXTENSIONS } from "../src/components/streams-workspace/preservation-contract";

function renderShell() {
  return renderToStaticMarkup(<ProjectWorkspaceShell />);
}

describe("universal project workspace shell", () => {
  it("mounts the existing builder as the central preserved implementation", () => {
    const html = renderShell();
    expect(html).toContain('data-testid="preserved-workspace-grid"');
    expect(html).toContain('data-preserved-builder-surface="true"');
    expect(html).toContain('data-replacement-conversion="true"');
  });

  it("keeps the complete top project and canvas controls", () => {
    const html = renderShell();
    expect(html).toContain('class="projectTopBar"');
    expect(html).toContain('class="projectOverviewBlock"');
    expect(html).toContain('class="canvasHeader"');
    for (const action of ["Version history", "Preview", "Share", "Export", "Publish / Complete"]) {
      expect(html).toContain(`>${action}<`);
    }
    for (const control of ["Device preview", "Zoom", "Undo", "Redo", "Compare versions", "Full screen"]) {
      expect(html).toContain(`>${control}<`);
    }
  });

  it("keeps the left project-context panel mounted and open with its complete data contract", () => {
    const html = renderShell();
    expect(DEFAULT_WORKSPACE_STATE.projectPanelOpen).toBe(true);
    expect(html).toContain('aria-label="Project context"');
    expect(html).toContain("Project Context");
    expect(html).toContain("Project Overview");
    expect(html).toContain("Files and Inputs");
    expect(html).toContain("Project Memory");
    expect(html).toContain("Project Structure");
    for (const renderedPrefix of ["Goal:", "Audience:", "Status:", "Description:", "Instructions:", "Brand / style:", "Workspace type:", "Project ID:", "Current stage:", "Progress:", "Next action:"]) {
      expect(html).toContain(renderedPrefix);
    }
    expect(PROJECT_CONTEXT_GROUPS.overview).toEqual(expect.arrayContaining(["Project name", "Goal", "Audience", "Current status", "Project description", "Important instructions", "Brand or style preferences"]));
    expect(PROJECT_CONTEXT_GROUPS.filesAndInputs).toEqual(expect.arrayContaining(["Documents", "Images", "Screenshots", "Videos", "Audio", "Spreadsheets", "Code files", "Links", "Notes", "Original prompt"]));
    expect(PROJECT_CONTEXT_GROUPS.memory).toEqual(expect.arrayContaining(["User decisions", "Selected concepts", "Approved styles", "Rejected options", "Requirements", "Constraints", "Previous outputs"]));
    expect(PROJECT_CONTEXT_GROUPS.codingStructure).toEqual(expect.arrayContaining(["Files", "Routes", "Components", "Data", "APIs", "Repository", "Source truth", "Checkpoints"]));
  });

  it("keeps the right utility panel and all contextual functions mounted and open by default", () => {
    const html = renderShell();
    expect(DEFAULT_WORKSPACE_STATE.inspectorOpen).toBe(true);
    expect(html).toContain('aria-label="Contextual utility panel"');
    for (const tab of Object.keys(RIGHT_PANEL_SECTIONS)) {
      expect(html).toContain(`>${tab}<`);
    }
    for (const item of RIGHT_PANEL_SECTIONS.Properties) {
      expect(html).toContain(item);
    }
    expect(RIGHT_PANEL_SECTIONS.Content).toEqual(expect.arrayContaining(["Title", "Description", "Button text", "Image", "Links", "Metadata"]));
    expect(RIGHT_PANEL_SECTIONS.Generate).toEqual(expect.arrayContaining(["Generate variation", "Replace", "Rewrite", "Expand", "Shorten", "Restyle", "Create alternatives"]));
    expect(RIGHT_PANEL_SECTIONS["Project Guidance"]).toEqual(expect.arrayContaining(["Missing items", "Recommended next steps", "Validation warnings", "Completion checklist"]));
  });

  it("renders the complete clean global navigation rail", () => {
    const html = renderShell();
    expect(html).toContain('aria-label="StreamsAI global navigation"');
    for (const item of ["Home", "Projects", "Workspace", "Files", "Create", "Generate", "Build", "Assets", "Tasks", "History", "Ask AI", "Settings"]) {
      expect(html).toContain(`title="${item}"`);
    }
  });

  it("keeps the universal and coding bottom tray functions available", () => {
    const html = renderShell();
    expect(html).toContain('aria-label="Workspace supporting materials"');
    expect(html).toContain('class="workspaceBottomTray"');
    for (const tab of [...UNIVERSAL_BOTTOM_TRAY_ITEMS, ...CODING_BOTTOM_TRAY_EXTENSIONS]) {
      expect(html).toContain(`>${tab}<`);
    }
  });
});
