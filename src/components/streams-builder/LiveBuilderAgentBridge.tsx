"use client";

import { useEffect, useRef, useState } from "react";
import type { PulledFileDetail } from "./builderSystemContract";

type Props = {
  activeFile: PulledFileDetail;
  sessionId?: string;
  onProof?: (message: string) => void;
};

type ChatCommandDetail = {
  message?: string;
  prompt?: string;
  sessionId?: string;
  projectId?: string;
};

type ExecutionResponse = {
  ok?: boolean;
  error?: string;
  queuedJob?: { id?: string };
  plan?: { blockedReasons?: string[] };
};

const BUILD_INTENT = /\b(build|create|implement|change|edit|update|fix|repair|debug|troubleshoot|refactor|redesign|replace|remove|add|connect|wire|test|verify|deploy|preview|frontend|backend|api|database|component|page|route|code)\b/i;

function realTarget(path: string) {
  const value = String(path || "").trim();
  if (!value || value.startsWith("generated/previews/")) return [];
  return [value];
}

export default function LiveBuilderAgentBridge({ activeFile, sessionId, onProof }: Props) {
  const [state, setState] = useState("Builder agent ready");
  const runningRef = useRef(false);
  const activeFileRef = useRef(activeFile);
  const sessionRef = useRef(sessionId || "");

  useEffect(() => { activeFileRef.current = activeFile; }, [activeFile]);
  useEffect(() => { sessionRef.current = sessionId || ""; }, [sessionId]);

  useEffect(() => {
    async function onCommand(event: Event) {
      const detail = (event as CustomEvent<ChatCommandDetail>).detail || {};
      const prompt = String(detail.message || detail.prompt || "").trim();
      if (!prompt || !BUILD_INTENT.test(prompt) || runningRef.current) return;

      const file = activeFileRef.current;
      const resolvedSessionId = String(detail.sessionId || sessionRef.current || "builder-live-session");
      const repoFullName = file.repo && file.repo.includes("/") ? file.repo : "hawk7227/streamsailive";
      const branchName = file.branch && file.branch !== "runtime-preview" ? file.branch : "main";
      const targetFiles = realTarget(file.path);
      const route = file.route || "/";

      runningRef.current = true;
      setState("Analyzing source truth…");
      onProof?.(`builder-agent: received command — ${prompt}`);
      window.dispatchEvent(new CustomEvent("streams-builder-summary-event", { detail: { phase: "builder.agent.command.received", message: `Builder agent received: ${prompt}` } }));

      try {
        const response = await fetch("/api/streams-builder/repository-execution", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            projectId: detail.projectId || "streams-live-builder",
            sessionId: resolvedSessionId,
            repoFullName,
            branchName,
            baseBranch: "main",
            route,
            userPrompt: [
              "Act as the Streams Codex × Cursor hybrid senior engineering agent.",
              "Use repository source truth. Do not guess file contents or claim success without command proof.",
              "Implement the user's requested change, inspect failures, repair boundedly, rerun verification, and preserve rollback evidence.",
              `User request: ${prompt}`,
              file.path ? `Active source: ${file.path}` : "No exact source file selected; inspect the repository before editing.",
            ].join("\n"),
            requestedCommands: targetFiles.length
              ? ["clone_repo", "read_full_file", "npm_run_build", "git_status", "git_diff"]
              : ["clone_repo", "npm_run_build", "git_status", "git_diff"],
            targetFiles,
            enqueue: true,
            autoRunWorker: true,
            autonomousRepair: true,
            maxRepairAttempts: 5,
            maxFilesTouched: 8,
            runBuildAfterPatch: true,
            requireApprovalBeforePush: true,
            approvalGranted: false,
          }),
        });
        const payload = await response.json().catch(() => null) as ExecutionResponse | null;
        if (!response.ok || !payload?.ok) {
          const blocked = payload?.plan?.blockedReasons?.join("; ");
          throw new Error(payload?.error || blocked || `Builder execution request failed: ${response.status}`);
        }
        const jobId = String(payload.queuedJob?.id || "");
        if (!jobId) throw new Error("Builder worker did not return a job id.");

        setState(`Active · ${jobId}`);
        onProof?.(`builder-agent: autonomous worker queued ${jobId}`);
        window.dispatchEvent(new CustomEvent("streams-builder:runtime-job", { detail: { jobId, repo: repoFullName, branch: branchName, path: targetFiles[0] || "", route, prompt } }));
        window.dispatchEvent(new CustomEvent("streams-builder-summary-event", { detail: { phase: "builder.agent.worker.queued", message: `Autonomous Builder worker queued: ${jobId}` } }));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Builder agent command failed.";
        setState(`Blocked · ${message}`);
        onProof?.(`builder-agent-error: ${message}`);
        window.dispatchEvent(new CustomEvent("streams-builder-summary-event", { detail: { phase: "builder.agent.failed", message } }));
      } finally {
        runningRef.current = false;
      }
    }

    window.addEventListener("streams:authoritative-chat-command", onCommand);
    return () => window.removeEventListener("streams:authoritative-chat-command", onCommand);
  }, [onProof]);

  return <div aria-live="polite" title="Live autonomous Builder agent" style={{ fontSize: 10, color: state.startsWith("Blocked") ? "#fca5a5" : "#6ee7b7", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Codex × Cursor Agent: {state}</div>;
}
