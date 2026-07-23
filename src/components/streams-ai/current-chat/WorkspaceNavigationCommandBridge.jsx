"use client";

import { useLayoutEffect } from "react";

const ACTIVE_PROJECT_NAME_KEY = "streams-ai:active-project-name";

function encodeSseEvent(type, data) {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

function makeWorkspaceResponse(message) {
  const encoder = new TextEncoder();
  const startedAt = Date.now();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(encodeSseEvent("activity", {
        phase: "workspace.navigation",
        mode: "local-ui-action",
        statusText: "Opening merged workspace…",
        startedAt,
      })));
      controller.enqueue(encoder.encode(encodeSseEvent("response", { token: message })));
      controller.enqueue(encoder.encode(encodeSseEvent("complete", {
        elapsedMs: Date.now() - startedAt,
        mode: "workspace-navigation",
        localUiAction: true,
      })));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

function chatMessageFromBody(init) {
  try {
    if (!init?.body || typeof init.body !== "string") return "";
    const body = JSON.parse(init.body);
    return String(body?.message || body?.input || body?.prompt || body?.text || body?.content || "").trim();
  } catch {
    return "";
  }
}

export function isWorkspaceNavigationIntent(message = "") {
  const text = String(message || "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!text) return false;
  const requestsNavigation = /\b(open|show|switch|go|take me|enter|launch|display)\b/.test(text);
  const namesWorkspace = /\b(merged )?(streams )?(builder|project )?(preview )?workspace\b/.test(text)
    || /\bstreams builder\b/.test(text)
    || /\bmerged preview\b/.test(text);
  return requestsNavigation && namesWorkspace;
}

export default function WorkspaceNavigationCommandBridge() {
  useLayoutEffect(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init = {}) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input?.url || "";
      const method = String(init?.method || (typeof input !== "string" && !(input instanceof URL) ? input?.method : "GET") || "GET").toUpperCase();
      if (method === "POST" && url === "/api/streams-ai/messages") {
        const message = chatMessageFromBody(init);
        if (isWorkspaceNavigationIntent(message)) {
          const activeProjectName = window.localStorage.getItem(ACTIVE_PROJECT_NAME_KEY) || "Streams Builder";
          const confirmation = [
            `Opening the merged Streams Builder workspace for ${activeProjectName}.`,
            "The current chat session and active project remain connected on this same StreamsAI route.",
            "Workspace mode: Primary Builder.",
            "Repository, branch, folder, and file controls are available in the builder toolbar.",
            "Front View Editor, Code Editor, Diff, Logs, and Media remain available in the preserved builder.",
            "The bottom tray includes Assets, Outputs, Tasks, Activity, Versions, Comments, Console, Logs, Diff, Proof, and Verification.",
          ].join("\n\n");
          window.setTimeout(() => {
            window.dispatchEvent(new CustomEvent("streams-ai:set-experience-view", { detail: { view: "workspace", source: "chat-command" } }));
          }, 60);
          return makeWorkspaceResponse(confirmation);
        }
      }
      return originalFetch(input, init);
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
