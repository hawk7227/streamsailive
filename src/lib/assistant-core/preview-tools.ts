import type { ToolProgressHandlers } from "./contracts";
import type { AssistantFunctionToolDefinition } from "./github-tools";

type JsonObject = Record<string, unknown>;

type ExecutePreviewToolInput = {
  name: string;
  args: Record<string, unknown>;
};

const PREVIEW_TOOL_NAMES = new Set([
  "preview_set_active",
  "preview_escalate",
  "preview_pin",
  "preview_send_media",
]);

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} must be a non-empty string.`);
  }
  return value.trim();
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function isAssistantPreviewTool(name: string): boolean {
  return PREVIEW_TOOL_NAMES.has(name);
}

export function buildAssistantPreviewTools(): AssistantFunctionToolDefinition[] {
  return [
    {
      type: "function",
      name: "preview_set_active",
      description: "Open or activate a verified project preview. Optionally navigate the preview to a route.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          previewId: { type: "string", description: "Verified preview identifier." },
          route: { type: "string", description: "Optional application route to display." },
        },
        required: ["previewId"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "preview_escalate",
      description: "Escalate a preview into the larger or primary preview surface.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          previewId: { type: "string", description: "Verified preview identifier." },
          route: { type: "string", description: "Optional application route to display." },
        },
        required: ["previewId"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "preview_pin",
      description: "Pin or unpin a verified preview in the workspace.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          previewId: { type: "string", description: "Verified preview identifier." },
          pinned: { type: "boolean", description: "True to pin, false to unpin." },
        },
        required: ["previewId", "pinned"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "preview_send_media",
      description: "Send an existing image, video, or audio asset to a workspace preview screen.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "Asset URL to display." },
          mediaType: { type: "string", enum: ["image", "video", "audio"] },
          screen: { type: "string", description: "Optional target screen identifier." },
        },
        required: ["url", "mediaType"],
        additionalProperties: false,
      },
    },
  ];
}

export async function executeAssistantPreviewTool(
  input: ExecutePreviewToolInput,
  handlers?: ToolProgressHandlers,
): Promise<JsonObject> {
  if (!isAssistantPreviewTool(input.name)) {
    return { ok: false, error: `Unknown preview tool: ${input.name}` };
  }

  if (input.name === "preview_set_active") {
    const previewId = requiredString(input.args.previewId, "previewId");
    handlers?.onProgress?.(`activating preview ${previewId}`);
    return {
      ok: true,
      action: "PREVIEW_SET_ACTIVE",
      payload: { previewId, route: optionalString(input.args.route) },
    };
  }

  if (input.name === "preview_escalate") {
    const previewId = requiredString(input.args.previewId, "previewId");
    handlers?.onProgress?.(`escalating preview ${previewId}`);
    return {
      ok: true,
      action: "PREVIEW_ESCALATE",
      payload: { previewId, route: optionalString(input.args.route) },
    };
  }

  if (input.name === "preview_pin") {
    const previewId = requiredString(input.args.previewId, "previewId");
    const pinned = input.args.pinned === true;
    handlers?.onProgress?.(`${pinned ? "pinning" : "unpinning"} preview ${previewId}`);
    return {
      ok: true,
      action: "PREVIEW_PIN",
      payload: { previewId, pinned },
    };
  }

  const url = requiredString(input.args.url, "url");
  const mediaType = requiredString(input.args.mediaType, "mediaType");
  handlers?.onProgress?.(`sending ${mediaType} to preview`);
  return {
    ok: true,
    action: "SEND_TO_SCREEN",
    payload: { url, mediaType, screen: optionalString(input.args.screen) },
  };
}
