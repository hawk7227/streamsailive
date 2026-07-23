import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/streams-builder/WorkspaceGrid", () => ({
  default: () => <div data-testid="preserved-workspace-grid">Preserved WorkspaceGrid</div>,
}));

import ProjectWorkspaceShell from "../src/components/streams-workspace/ProjectWorkspaceShell";

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

  it("removes top overlay panels so the manual GitHub row owns the first working line", () => {
    const html = renderShell();
    expect(html).toContain('data-top-panels="removed"');
    expect(html).toContain('data-first-working-row="manual-github-controls"');
    expect(html).not.toContain('class="projectTopBar"');
    expect(html).not.toContain('class="projectOverviewBlock"');
    expect(html).not.toContain('class="canvasHeader"');
    expect(html).not.toContain("Publish / Complete");
    expect(html).not.toContain("Next Recommended Action");
  });

  it("keeps the builder canvas dominant and removes both side-panel systems", () => {
    const html = renderShell();
    expect(html).toContain('aria-label="Main workspace canvas"');
    expect(html).toContain('data-side-panels="removed"');
    expect(html).not.toContain('aria-label="Project context"');
    expect(html).not.toContain('aria-label="Contextual utility panel"');
    expect(html).not.toContain('aria-label="Workspace panel preview switcher"');
    expect(html).not.toContain("floatingWorkspaceSwitcher");
    expect(html).not.toContain("floatingWorkspaceDrawer");
  });

  it("renders the complete clean global navigation rail", () => {
    const html = renderShell();
    expect(html).toContain('aria-label="StreamsAI global navigation"');
    for (const item of ["Home", "Projects", "Workspace", "Files", "Create", "Generate", "Build", "Assets", "Tasks", "History", "Ask AI", "Settings"]) {
      expect(html).toContain(`title="${item}"`);
    }
  });

  it("removes the permanent supporting tray from the builder workspace", () => {
    const html = renderShell();
    expect(html).toContain('data-bottom-tray="removed"');
    expect(html).not.toContain('aria-label="Workspace supporting materials"');
    expect(html).not.toContain('class="workspaceBottomTray"');
    for (const tab of ["Outputs", "Activity", "Versions", "Comments", "Console", "Logs", "Diff", "Proof", "Verification"]) {
      expect(html).not.toContain(`>${tab}<`);
    }
  });
});
