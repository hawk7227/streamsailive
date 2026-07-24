import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import StreamsUnifiedRoot from "../src/components/streams-ai/current-chat/StreamsUnifiedRoot";
import StreamsUniversalExperience from "../src/components/streams-ai/current-chat/StreamsUniversalExperience";
import WorkspaceGrid from "../src/components/streams-builder/WorkspaceGrid";
import { ProjectWorkspaceController } from "../src/components/streams-workspace/ProjectWorkspaceController";
import GlobalNavigationRail from "../src/components/streams-workspace/GlobalNavigationRail";
import ProjectWorkspaceShell from "../src/components/streams-workspace/ProjectWorkspaceShell";


describe("universal Streams web cutover", () => {
  it("keeps the unified experience hydration-safe before client restoration", () => {
    const html = renderToStaticMarkup(<StreamsUnifiedRoot />);
    expect(html).toContain("Streams loading");
  });

  it("keeps the universal experience hydration-safe directly", () => {
    const html = renderToStaticMarkup(<StreamsUniversalExperience />);
    expect(html).toContain("Streams loading");
  });

  it("keeps workspace navigation behind explicit UI controls", () => {
    const html = renderToStaticMarkup(<StreamsUnifiedRoot />);
    expect(html).not.toContain("Opening merged workspace");
    expect(html).not.toContain("workspace-navigation");
  });

  it("renders the restored builder without permanent side or top overlays", () => {
    const html = renderToStaticMarkup(<ProjectWorkspaceShell />);
    expect(html).toContain('data-side-panels="removed"');
    expect(html).toContain('data-top-overlays="removed"');
    expect(html).toContain('data-bottom-tray="restored"');
    expect(html).toContain('data-workstation-screens="restored"');
    expect(html).toContain('data-preserved-builder-surface="true"');
    expect(html).toContain('data-first-working-row="manual-github-controls"');
    expect(html).toContain('aria-label="StreamsAI global navigation"');
    expect(html).not.toContain('aria-label="Project context"');
    expect(html).not.toContain('aria-label="Contextual utility panel"');
    expect(html).not.toContain('class="projectTopBar"');
    expect(html).not.toContain('class="projectOverviewBlock"');
    expect(html).toContain('aria-label="Workspace supporting materials"');
    expect(html).toContain('class="workspaceBottomTray"');
  });

  it("preserves every workstation screen behind the hydration gate", () => {
    const html = renderToStaticMarkup(<ProjectWorkspaceShell />);
    expect(html).toContain('<main class="streamsBuilderShell" aria-hidden="true"></main>');
    expect(html).not.toContain('class="liveWorkstation"');
    expect(html).not.toContain('class="visualEditor"');
    expect(html).not.toContain('class="workstationShell"');
    expect(html).not.toContain('aria-label="Frontend workstation views"');

    const source = WorkspaceGrid.toString();
    for (const component of [
      "LiveFrontendWorkstation",
      "VisualEditingWorkstation",
      "VisualOperationDock",
      "TopRowWorkstationControls",
      "WorkspaceModulePanel",
    ]) {
      expect(source).toContain(component);
    }
    expect(source).toContain("hydrated");
    expect(source).not.toContain("builderUnifiedTopRowActions");
    expect(source).not.toContain("data-unified-duplicate");
  });

  it("does not render the floating experience overlay inside workspace mode", () => {
    const source = StreamsUniversalExperience.toString();
    expect(source).toContain('activeView === "chat"');
    expect(source).not.toContain('data-active-view="workspace"] .experienceSwitcher');
  });

  it("renders the compact universal global navigation rail", () => {
    const html = renderToStaticMarkup(<ProjectWorkspaceController><GlobalNavigationRail /></ProjectWorkspaceController>);
    expect(html).toContain('aria-label="StreamsAI global navigation"');
    expect(html).toContain('aria-label="New session"');
    for (const item of ["Home", "Projects", "Workspace", "Files", "Create", "Generate", "Build", "Assets", "Tasks", "History", "Ask AI", "Settings"]) {
      expect(html).toContain(`title="${item}"`);
    }
    expect(html).not.toContain("Business Builder");
    expect(html).not.toContain("Revenue");
    expect(html).not.toContain("Creator Studio");
    expect(html).not.toContain("Your AI Business Operator");
  });
});