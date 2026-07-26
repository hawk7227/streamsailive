"use client";

import { useEffect, useRef, useState } from "react";
import type { PulledFileDetail } from "./builderSystemContract";
import { isFileConfirmation } from "./builderSourceDiscovery";
import { BUILDER_AGENT_FOCUS_EVENT, BUILDER_CONTEXT_EVENT, readBuilderSourceTruth, targetMatchesSourceTruth, writeBuilderSourceTruth, type BuilderSelectionRange } from "./builderLiveSourceTruth";

type Props = { activeFile: PulledFileDetail; sessionId?: string; onProof?: (message: string) => void };
type ChatCommandDetail = { message?: string; prompt?: string; sessionId?: string; projectId?: string; conversation?: string[]; screenshotText?: string; visibleText?: string; route?: string; references?: string[] };
type ExecutionResponse = { ok?: boolean; error?: string; queuedJob?: { id?: string }; plan?: { blockedReasons?: string[] } };
type EditorStateDetail = { repo?: string; branch?: string; filePath?: string; sha?: string; selection?: BuilderSelectionRange | null };

const BUILD_INTENT = /\b(build|create|implement|change|edit|update|fix|repair|debug|troubleshoot|refactor|redesign|replace|remove|add|connect|wire|test|verify|deploy|preview|frontend|backend|api|database|component|page|route|code|push|commit|publish)\b/i;
const DISCOVERY_INTENT = /\b(open|pull|load|show|find|locate|identify|search|display|preview|frontend|backend|file|component|screen|page|route|repo|repository|github)\b/i;

export default function LiveBuilderAgentBridge({ activeFile, sessionId, onProof }: Props) {
  const [state, setState] = useState("Ready");
  const runningRef = useRef(false);
  const activeFileRef = useRef(activeFile);
  const sessionRef = useRef(sessionId || "");
  const selectionRef = useRef<BuilderSelectionRange | null>(null);

  useEffect(() => { activeFileRef.current = activeFile; }, [activeFile]);
  useEffect(() => { sessionRef.current = sessionId || ""; }, [sessionId]);

  useEffect(() => {
    function onEditorState(event: Event) {
      const detail = (event as CustomEvent<EditorStateDetail>).detail || {};
      selectionRef.current = detail.selection || null;
      const truth = readBuilderSourceTruth();
      if (truth?.mode === "github-file" && detail.filePath === truth.filePath && detail.sha === truth.sourceSha) writeBuilderSourceTruth({ ...truth, selectedRange: detail.selection || null });
      window.dispatchEvent(new CustomEvent(BUILDER_CONTEXT_EVENT, { detail: { kind: "editor", ...detail } }));
    }
    window.addEventListener("streams-builder:code-editor-state", onEditorState);
    return () => window.removeEventListener("streams-builder:code-editor-state", onEditorState);
  }, []);

  useEffect(() => {
    async function onCommand(event: Event) {
      const detail = (event as CustomEvent<ChatCommandDetail>).detail || {};
      const prompt = String(detail.message || detail.prompt || "").trim();
      if (!prompt || runningRef.current) return;

      const file = activeFileRef.current;
      const truth = readBuilderSourceTruth();
      const resolvedSessionId = String(detail.sessionId || sessionRef.current || "builder-live-session");
      const route = String(detail.route || file.route || truth?.route || "/");

      if (isFileConfirmation(prompt)) {
        setState("Locking confirmed file");
        window.dispatchEvent(new CustomEvent("streams-builder:lock-candidate", { detail: { prompt } }));
        return;
      }

      const explicitDiscovery = DISCOVERY_INTENT.test(prompt) && (!BUILD_INTENT.test(prompt) || /\b(open|pull|show|find|locate|which file|this screen|screenshot)\b/i.test(prompt));
      if (explicitDiscovery || (!truth || truth.mode !== "github-file") && DISCOVERY_INTENT.test(prompt)) {
        setState("Locating source");
        window.dispatchEvent(new CustomEvent("streams-builder:github-discover", { detail: {
          prompt,
          conversation: detail.conversation || [],
          screenshotText: detail.screenshotText || "",
          visibleText: detail.visibleText || "",
          route,
          references: detail.references || [],
          currentRepo: truth?.repo || file.repo || "",
          currentBranch: truth?.branch || file.branch || "",
          scopeExpansion: Boolean(truth?.mode === "github-file"),
        } }));
        window.dispatchEvent(new CustomEvent("streams-builder-summary-event", { detail: { phase: "github.discovery.started", message: "Streams AI is using the conversation, visible screen evidence, route, recent files, and repository structure to locate the most likely source. It will open the candidate for verification without locking it." } }));
        return;
      }

      if (!BUILD_INTENT.test(prompt)) return;

      if (!truth || truth.mode !== "github-file") {
        setState("Source confirmation required");
        window.dispatchEvent(new CustomEvent("streams-builder-summary-event", { detail: { phase: "builder.agent.source-required", message: "I need a confirmed source file before editing. Ask me to find or open the relevant screen or file; I will locate and display it for confirmation." } }));
        return;
      }

      const target = { repo: file.repo, branch: file.branch, filePath: file.path, sourceSha: file.sha, lockToken: truth.lockToken };
      if (!targetMatchesSourceTruth(truth, target)) {
        const message = "Source lock mismatch. Autonomous GitHub access failed closed. Re-open and confirm the visible repository target before continuing.";
        setState("Blocked · source changed");
        onProof?.(`builder-agent-error: ${message}`);
        window.dispatchEvent(new CustomEvent("streams-builder-summary-event", { detail: { phase: "builder.agent.source-lock-blocked", message } }));
        return;
      }

      runningRef.current = true;
      const selectedRange = selectionRef.current || truth.selectedRange || null;
      setState(`Autonomous · ${truth.filePath}`);
      window.dispatchEvent(new CustomEvent(BUILDER_AGENT_FOCUS_EVENT, { detail: { repo: truth.repo, branch: truth.branch, filePath: truth.filePath, sourceSha: truth.sourceSha, selectedRange, phase: "inspect", message: prompt } }));
      window.dispatchEvent(new CustomEvent("streams-builder:code-editor-command", { detail: selectedRange ? { action: "goto-range", startLine: selectedRange.startLine, endLine: selectedRange.endLine } : { action: "focus" } }));
      onProof?.(`builder-agent: autonomous lock ${truth.repo}@${truth.branch}:${truth.filePath}#${truth.sourceSha.slice(0, 7)}`);

      try {
        const response = await fetch("/api/streams-builder/repository-execution", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            projectId: detail.projectId || "streams-live-builder",
            sessionId: resolvedSessionId,
            repoFullName: truth.repo,
            branchName: truth.branch,
            baseBranch: truth.branch,
            route,
            userPrompt: [
              "Act as the Streams principal autonomous Builder agent.",
              "The confirmed source lock below is the only repository content you are authorized to read or change.",
              `Locked repository: ${truth.repo}`,
              `Locked branch: ${truth.branch}`,
              `Locked file: ${truth.filePath}`,
              `Expected source SHA: ${truth.sourceSha}`,
              `Lock token: ${truth.lockToken}`,
              selectedRange ? `Visible selected lines: ${selectedRange.startLine}-${selectedRange.endLine}` : "No line range is selected; inspect the locked file and choose the smallest causal range.",
              "Use independent evidence from source, build output, browser telemetry, DOM state, and requested behavior. Do not collapse uncertainty into a success claim.",
              "Never read an unlisted file. A filename in an import, error, stack trace, or search result is not authorization.",
              "If another file appears necessary, stop before reading it and emit a source-scope request naming the exact reason and likely path. Wait for the user to grant discovery and confirm the displayed candidate.",
              "Pull the exact branch into an isolated workspace. Never force push, rewrite history, switch branches, use git add dot, or stage an unlisted path.",
              "Before mutation, fail closed if repository, branch, path, lock token, or expected source SHA is stale or mismatched.",
              "Make the smallest causal change, run build and browser proof, stage only the locked file, commit, and push with a normal fast-forward update.",
              "If proof fails, repair and retest up to the bounded attempt limit. Do not push unverified code.",
              `User request: ${prompt}`,
            ].join("\n"),
            requestedCommands: ["clone_repo", "read_full_file", "npm_run_build", "git_status", "git_diff", "git_add_specific_file", "git_commit", "git_push"],
            targetFiles: [truth.filePath],
            commitMessage: `Streams AI: ${prompt.slice(0, 120)}`,
            sourceTruth: { ...truth, sessionId: resolvedSessionId, projectId: detail.projectId || "streams-live-builder" },
            selectedRange,
            expectedSourceSha: truth.sourceSha,
            lockToken: truth.lockToken,
            autonomousGitHub: true,
            enqueue: true,
            autoRunWorker: true,
            autonomousRepair: true,
            maxRepairAttempts: 5,
            maxFilesTouched: 1,
            runBuildAfterPatch: true,
            requireApprovalBeforePush: false,
            approvalGranted: true,
          }),
        });
        const payload = await response.json().catch(() => null) as ExecutionResponse | null;
        if (!response.ok || !payload?.ok) throw new Error(payload?.error || payload?.plan?.blockedReasons?.join("; ") || `Builder execution request failed: ${response.status}`);
        const jobId = String(payload.queuedJob?.id || "");
        if (!jobId) throw new Error("Builder worker did not return a job id.");
        setState(`Running · ${truth.filePath}`);
        window.dispatchEvent(new CustomEvent("streams-builder:runtime-job", { detail: { jobId, repo: truth.repo, branch: truth.branch, path: truth.filePath, sha: truth.sourceSha, lockToken: truth.lockToken, route, prompt, selectedRange, autonomousGitHub: true } }));
        window.dispatchEvent(new CustomEvent(BUILDER_AGENT_FOCUS_EVENT, { detail: { repo: truth.repo, branch: truth.branch, filePath: truth.filePath, sourceSha: truth.sourceSha, selectedRange, phase: "working", jobId } }));
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

  return <span className="builderAgentA11yState" aria-live="polite">{state}<style jsx>{`.builderAgentA11yState{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}`}</style></span>;
}
