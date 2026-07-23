"use client";

import { useLayoutEffect } from "react";

const ACTIVE_PROJECT_KEY = "streams-ai:active-project-id";

function parseBody(body) {
  try { return typeof body === "string" ? JSON.parse(body) : null; } catch { return null; }
}

export default function ActiveProjectChatBridge() {
  useLayoutEffect(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init = {}) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input?.url || "";
      const method = String(init?.method || (typeof input !== "string" && !(input instanceof URL) ? input?.method : "GET") || "GET").toUpperCase();
      if (method === "POST" && (url === "/api/streams-ai/messages" || url.startsWith("/api/streams-ai/messages?"))) {
        const projectId = window.localStorage.getItem(ACTIVE_PROJECT_KEY) || "";
        const body = parseBody(init?.body);
        if (projectId && body && typeof body === "object") {
          const headers = new Headers(init?.headers || {});
          headers.set("Content-Type", "application/json");
          return originalFetch(input, {
            ...init,
            headers,
            body: JSON.stringify({
              ...body,
              projectId,
              metadata: { ...(body.metadata || {}), activeProjectId: projectId, sourceSurface: "unified-streams-ai" },
            }),
          });
        }
      }
      return originalFetch(input, init);
    };
    return () => { window.fetch = originalFetch; };
  }, []);

  return null;
}
