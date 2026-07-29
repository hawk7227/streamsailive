import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Streams Chat preview and original Visual Editor restoration", () => {
  it("opens the requested surface before starting the assistant request", () => {
    const chat = source("src/components/streams-builder/ActualBuilderSessionChat.tsx");
    const intentIndex = chat.indexOf("routePreviewSurfaceIntent(clean");
    const openIndex = chat.indexOf("new CustomEvent(OPEN_PREVIEW_EVENT");
    const requestIndex = chat.indexOf('fetch("/api/streams-ai/messages"');
    expect(intentIndex).toBeGreaterThan(-1);
    expect(openIndex).toBeGreaterThan(intentIndex);
    expect(requestIndex).toBeGreaterThan(openIndex);
    expect(chat).toContain('lifecycleState: "opening"');
    expect(chat).toContain("acceptChatCompletion");
  });

  it("updates the existing center preview surface instead of opening a second surface", () => {
    const center = source("src/components/streams-builder/LiveFrontendWorkstation.tsx");
    expect(center).toContain('window.addEventListener("streams:open-builder-preview", onOpenPreview)');
    expect(center).toContain('setTab("frontend")');
    expect(center).toContain("PreviewLifecycleState");
    expect(center).toContain("lastPreviewActionRef");
  });

  it("keeps the original far-right editor mounted and defaults it to edit mode", () => {
    const grid = source("src/components/streams-builder/WorkspaceGrid.tsx");
    const visual = source("src/components/streams-builder/VisualEditingWorkstation.tsx");
    expect(grid).toContain('aria-label="Original visual editor"');
    expect(grid).toContain("<VisualEditingWorkstation");
    expect(visual).toContain('useState<ViewMode>("editor")');
    expect(visual).toContain('detail.targetSurface !== "visual-editor"');
    expect(visual).toContain('setViewMode("editor")');
  });

  it("uses the existing source mapper and supports code-to-visual focus", () => {
    const visual = source("src/components/streams-builder/VisualEditingWorkstation.tsx");
    const editablePreview = source("src/app/api/streams-builder/editable-preview/route.ts");
    expect(visual).toContain("resolveElementSourceMapping");
    expect(visual).toContain('"streams-builder:active-work-target"');
    expect(visual).toContain('type: "streams-editor-focus-source"');
    expect(editablePreview).toContain("focusSourceSelection");
    expect(editablePreview).toContain("streams-editable-source-focus-ambiguous");
  });

  it("keeps external websites read-only and offers a safe new-tab fallback", () => {
    const visual = source("src/components/streams-builder/VisualEditingWorkstation.tsx");
    expect(visual).toContain("Read-only external page");
    expect(visual).toContain('title={externalUrl ? "Read-only external website"');
    expect(visual).toContain('target="_blank"');
    expect(visual).toContain("unavailable without source access");
  });
});
