import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProjectWorkspaceController } from "../src/components/streams-workspace/ProjectWorkspaceController";
import GlobalNavigationRail from "../src/components/streams-workspace/GlobalNavigationRail";
import ProjectTopBar from "../src/components/streams-workspace/ProjectTopBar";
import StreamsUniversalExperience from "../src/components/streams-ai/current-chat/StreamsUniversalExperience";

describe("universal Streams web cutover", () => {
  it("keeps the universal experience hydration-safe before client restoration", () => {
    const html = renderToStaticMarkup(<StreamsUniversalExperience />);
    expect(html).toContain("Streams loading");
  });

  it("renders real project actions rather than an inert project header", () => {
    const html = renderToStaticMarkup(
      <ProjectWorkspaceController>
        <ProjectTopBar />
      </ProjectWorkspaceController>,
    );
    expect(html).toContain("Return to StreamsAI chat");
    expect(html).toContain("Version history");
    expect(html).toContain("Preview");
    expect(html).toContain("Share");
    expect(html).toContain("Export");
    expect(html).toContain("Publish / Complete");
  });

  it("does not expose permanent Context or Utility side-panel controls", () => {
    const html = renderToStaticMarkup(
      <ProjectWorkspaceController>
        <ProjectTopBar />
      </ProjectWorkspaceController>,
    );
    expect(html).not.toContain("Toggle project context");
    expect(html).not.toContain("Toggle utility panel");
    expect(html).toContain("Toggle bottom tray");
  });

  it("restores and merges the full Streams AI grouped menu", () => {
    const html = renderToStaticMarkup(
      <ProjectWorkspaceController>
        <GlobalNavigationRail />
      </ProjectWorkspaceController>,
    );
    expect(html).toContain("STREAMS AI");
    expect(html).toContain("Your AI Business Operator");
    expect(html).toContain("+ New session");
    expect(html).toContain("Main");
    expect(html).toContain("Build");
    expect(html).toContain("Create");
    expect(html).toContain("Project Tools");
    expect(html).toContain("Business Builder");
    expect(html).toContain("Revenue");
    expect(html).toContain("Visual Concepts");
    expect(html).toContain("Website Builder");
    expect(html).toContain("App Builder");
    expect(html).toContain("Preview + Launch");
    expect(html).toContain("Creator Studio");
    expect(html).toContain("Image Studio");
    expect(html).toContain("Video Studio");
    expect(html).toContain("Voice Studio");
    expect(html).toContain("Captions");
    expect(html).toContain("Turn This Into You");
    expect(html).toContain("Social Research");
    expect(html).toContain("Assets");
    expect(html).toContain("Tasks");
    expect(html).toContain("History");
    expect(html).toContain("Ask AI");
    expect(html).toContain("Settings");
  });
});
