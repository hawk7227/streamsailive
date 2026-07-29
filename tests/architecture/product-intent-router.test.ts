import { describe, expect, it } from "vitest";
import { routePreviewSurfaceIntent, routeProductIntent } from "@/lib/streams-ai/runtime/architecture/product-intent-router";

describe("authoritative product intent routing", () => {
  it("routes website builds without web search", () => {
    const route = routeProductIntent("Build a responsive website and only show me the frontend view");
    expect(route.intent).toBe("CREATE_WEBSITE");
    expect(route.requiresBuilder).toBe(true);
    expect(route.requiresCurrentInformation).toBe(false);
    expect(route.requestedOutput).toBe("PREVIEW_ONLY");
  });
  it("routes direct preview commands deterministically", () => expect(routeProductIntent("Open your preview").intent).toBe("OPEN_PREVIEW"));
  it("resolves failure references", () => expect(routeProductIntent("What happened?").intent).toBe("EXPLAIN_FAILURE"));
  it("resolves retry references", () => expect(routeProductIntent("Try it again").intent).toBe("RETRY_LAST_OPERATION"));

  it("opens browser review immediately for direct and contextual preview requests", () => {
    expect(routePreviewSurfaceIntent("Show me the frontend", { hasActivePreview: false })?.surface).toBe("center-preview");
    expect(routePreviewSurfaceIntent("Show it", { hasActivePreview: true })?.surface).toBe("center-preview");
  });

  it("opens the existing far-right editor for contextual visual-edit requests", () => {
    const decision = routePreviewSurfaceIntent("Let me edit it", { hasActivePreview: true, hasEditableSource: true });
    expect(decision).toMatchObject({ surface: "visual-editor", mode: "editor", immediate: true });
  });

  it("keeps external URLs in read-only browser mode", () => {
    expect(routePreviewSurfaceIntent("Show https://example.com in the Visual Editor", { hasEditableSource: false })).toMatchObject({
      surface: "visual-editor",
      mode: "browser",
      externalUrl: "https://example.com/",
    });
  });

  it("does not reset a surface when no preview or visual-edit intent exists", () => {
    expect(routePreviewSurfaceIntent("Explain how this works", { hasActivePreview: true, currentSurface: "visual-editor" })).toBeNull();
  });
});
