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

  it("keeps the left project-context panel mounted and open by default", () => {
    const html = renderShell();
    expect(DEFAULT_WORKSPACE_STATE.projectPanelOpen).toBe(true);
    expect(html).toContain('aria-label="Project context"');
    expect(html).toContain("Project Context");
    for (const item of [...PROJECT_CONTEXT_GROUPS.overview, ...PROJECT_CONTEXT_GROUPS.filesAndInputs, ...PROJECT_CONTEXT_GROUPS.memory, ...PROJECT_CONTEXT_GROUPS.codingStructure]) {
      expect(html).toContain(item);
    }
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
