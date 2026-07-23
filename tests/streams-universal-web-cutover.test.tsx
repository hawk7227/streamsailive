import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import StreamsUnifiedRoot from "../src/components/streams-ai/current-chat/StreamsUnifiedRoot";
import StreamsUniversalExperience from "../src/components/streams-ai/current-chat/StreamsUniversalExperience";
import { isWorkspaceNavigationIntent } from "../src/components/streams-ai/current-chat/WorkspaceNavigationCommandBridge";
import { ProjectWorkspaceController } from "../src/components/streams-workspace/ProjectWorkspaceController";
import GlobalNavigationRail from "../src/components/streams-workspace/GlobalNavigationRail";
import ProjectTopBar from "../src/components/streams-workspace/ProjectTopBar";
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

  it("recognizes workspace-opening chat commands locally", () => {
    expect(isWorkspaceNavigationIntent("Open the merged Streams Builder preview workspace for my active project.")).toBe(true);
    expect(isWorkspaceNavigationIntent("Switch to the workspace and keep this chat connected.")).toBe(true);
    expect(isWorkspaceNavigationIntent("Explain how the workspace works.")).toBe(false);
  });

  it("renders real project actions rather than an inert project header", () => {
    const html = renderToStaticMarkup(<ProjectWorkspaceController><ProjectTopBar /></ProjectWorkspaceController>);
    expect(html).toContain("Return to StreamsAI chat");
    expect(html).toContain("Version history");
    expect(html).toContain("Preview");
    expect(html).toContain("Share");
    expect(html).toContain("Export");
    expect(html).toContain("Publish / Complete");
  });

  it("removes both permanent side panels from the active builder workspace", () => {
    const html = renderToStaticMarkup(<ProjectWorkspaceShell />);
    expect(html).toContain('data-side-panels="removed"');
    expect(html).toContain('data-preserved-builder-surface="true"');
    expect(html).toContain('aria-label="StreamsAI global navigation"');
    expect(html).not.toContain('aria-label="Project context"');
    expect(html).not.toContain('aria-label="Contextual utility panel"');
  });

  it("does not expose permanent Context or Utility side-panel controls", () => {
    const html = renderToStaticMarkup(<ProjectWorkspaceController><ProjectTopBar /></ProjectWorkspaceController>);
    expect(html).not.toContain("Toggle project context");
    expect(html).not.toContain("Toggle utility panel");
    expect(html).toContain("Toggle bottom tray");
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
