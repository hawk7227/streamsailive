// Cache bust: 2026-04-28T23:33:00Z
import StreamsPanel from "@/components/streams/StreamsPanel";
import { StreamsWorkspaceShell } from "@/components/streams/workspace";
import { isStandaloneStreamsPanelMode } from "@/lib/streams/standalone-panel-mode";

export default function StreamsPage() {
  if (isStandaloneStreamsPanelMode()) {
    return <StreamsWorkspaceShell />;
  }

  return <StreamsPanel />;
}
