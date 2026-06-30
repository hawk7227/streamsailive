import { getWorkspaceEventKinds, getWorkspaceToolRegistry, getWorkspaceToolsForMode, summarizeWorkspaceCapabilities } from "@/lib/streams-builder/workspace-tool-registry";
import type { StreamsBuilderMode } from "@/lib/streams-builder/orchestrator-core";
import { recordBuilderSystemEvent } from "@/lib/streams-builder/system-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODES = new Set(["conversation", "inspect", "build", "repair", "visual-edit", "safety-intervention"]);

function cleanMode(value: string | null): StreamsBuilderMode | undefined {
  return value && MODES.has(value) ? (value as StreamsBuilderMode) : undefined;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId") || "agent-1";
  const mode = cleanMode(url.searchParams.get("mode"));
  const tools = mode ? getWorkspaceToolsForMode(mode) : getWorkspaceToolRegistry();
  const summary = summarizeWorkspaceCapabilities(mode);

  await recordBuilderSystemEvent({
    sessionId,
    phase: "workspace.capabilities.read",
    source: "workspace-capabilities-api",
    severity: "info",
    message: mode ? `Workspace capabilities read for ${mode}.` : "Workspace capabilities read.",
    status: mode || "all",
    metadata: { totalTools: tools.length, summary },
  });

  return Response.json({
    ok: true,
    mode: mode || "all",
    workspaceAwarenessRule: "Chat should know all meaningful workspace actions through builder events.",
    oneBrainRule: "The OpenAI orchestrator is the only planner/controller. Workspace tools report capability and events only.",
    summary,
    eventKinds: getWorkspaceEventKinds(),
    tools,
  });
}
