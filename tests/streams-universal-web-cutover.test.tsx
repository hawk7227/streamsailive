import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ProjectWorkspaceController } from "../src/components/streams-workspace/ProjectWorkspaceController";
import ProjectTopBar from "../src/components/streams-workspace/ProjectTopBar";
import ContextInspectorPanel from "../src/components/streams-workspace/ContextInspectorPanel";
import StreamsUniversalExperience from "../src/components/streams-ai/current-chat/StreamsUniversalExperience";

vi.mock("../src/components/streams-builder/PullRequestReviewPanel", () => ({ default: () => <div>Pull request review</div> }));

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

  it("keeps Ask AI contextual and connected to the preserved builder chat", () => {
    const html = renderToStaticMarkup(
      <ProjectWorkspaceController>
        <ContextInspectorPanel />
      </ProjectWorkspaceController>,
    );
    expect(html).toContain("Contextual utility panel");
    expect(html).toContain("Ask AI");
    expect(html).toContain("Project Guidance");
  });
});
