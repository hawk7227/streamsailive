import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/streams-builder/WorkspaceGrid", () => ({
  default: () => <div data-testid="preserved-workspace-grid">Preserved WorkspaceGrid</div>,
}));

import ProjectWorkspaceShell from "../src/components/streams-workspace/ProjectWorkspaceShell";

function renderShell() {
  return renderToStaticMarkup(<ProjectWorkspaceShell />);
}

function count(haystack: string, needle: string) {
  return haystack.split(needle).length - 1;
}

describe("universal project workspace shell", () => {
  it("mounts the existing builder as the central preserved implementation", () => {
    const html = renderShell();
    expect(html).toContain('data-testid="preserved-workspace-grid"');
    expect(html).toContain('data-preserved-builder-surface="true"');
    expect(html).toContain('data-replacement-conversion="true"');
  });

  it("renders the universal project identity and completion actions", () => {
    const html = renderShell();
    expect(count(html, "Streams Builder")).toBeGreaterThanOrEqual(2);
    expect(count(html, "Coding / Application")).toBeGreaterThanOrEqual(2);
    expect(html).toContain(">Preview<");
    expect(html).toContain(">Share<");
    expect(html).toContain(">Export<");
    expect(html).toContain(">Publish / Complete<");
  });

  it("keeps the project—not Ask AI—as the dominant canvas", () => {
    const html = renderShell();
    expect(html).toContain('aria-label="Main workspace canvas"');
    expect(html).toContain('aria-label="Project context"');
    expect(html).toContain('aria-label="Contextual utility panel"');
    expect(html).toContain('aria-label="Workspace supporting materials"');
  });

  it("renders the complete global navigation contract", () => {
    const html = renderShell();
    expect(html).toContain('aria-label="StreamsAI global navigation"');
    for (const item of ["Home", "Projects", "Workspace", "Files", "Create", "Generate", "Build", "Assets", "Tasks", "History", "Ask AI", "Settings"]) {
      expect(html).toContain(`title="${item}"`);
    }
  });

  it("renders universal context, canvas, utility, and tray controls", () => {
    const html = renderShell();
    for (const label of ["Project Goal", "Current Stage", "Progress", "Next Recommended Action"]) {
      expect(html).toContain(label);
    }
    expect(html).toContain(">Full screen<");
    for (const tab of ["Properties", "Generate", "Ask AI", "Outputs", "Activity", "Proof", "Verification"]) {
      expect(html).toContain(`>${tab}<`);
    }
  });
});
