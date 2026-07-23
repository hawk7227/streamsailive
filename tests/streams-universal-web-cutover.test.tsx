import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProjectWorkspaceController } from "../src/components/streams-workspace/ProjectWorkspaceController";
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
});
