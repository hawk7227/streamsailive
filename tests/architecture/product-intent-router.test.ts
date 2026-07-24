import { describe, expect, it } from "vitest";
import { routeProductIntent } from "@/lib/streams-ai/runtime/architecture/product-intent-router";

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
});
