"use client";

import { useEffect, useRef, useState } from "react";
import type { PulledFileDetail } from "./builderSystemContract";
import { BUILDER_AGENT_FOCUS_EVENT, BUILDER_CONTEXT_EVENT, readBuilderSourceTruth, targetMatchesSourceTruth, writeBuilderSourceTruth, type BuilderSelectionRange } from "./builderLiveSourceTruth";

type Props = { activeFile: PulledFileDetail; sessionId?: string; onProof?: (message: string) => void };
type ChatCommandDetail = { message?: string; prompt?: string; sessionId?: string; projectId?: string };
type ExecutionResponse = { ok?: boolean; error?: string; queuedJob?: { id?: string }; plan?: { blockedReasons?: string[] } };
type EditorStateDetail = { repo?: string; branch?: string; filePath?: string; sha?: string; selection?: BuilderSelectionRange | null };

const BUILD_INTENT = /\b(build|create|implement|change|edit|update|fix|repair|debug|troubleshoot|refactor|redesign|replace|remove|add|connect|wire|test|verify|deploy|preview|frontend|backend|api|database|component|page|route|code|push|commit|publish)\b/i;
const PULL_INTENT = /\b(pull|load|open|select)\b.*\b(github|repo|repository|branch|file)\b|\b(github|repo|repository)\b.*\b(pull|load|open|select)\b/i;

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
      const route = file.route || truth?.route || "/";

      if (PULL_INTENT.test(prompt) && (!truth || truth.mode !== "github-file")) {
        setState("Select source to lock");
        window.dispatchEvent(new CustomEvent("streams-builder:github-open-controls"));
        window.dispatchEvent(new CustomEvent("streams-builder-summary-event", { detail: { phase: "github.pull.selection-required", message: "Select the repository, branch, folder, and file once. After it is locked, Streams AI may pull, repair, commit, and push that exact target autonomously." } }));
        return;
      }

      if (!BUILD_INTENT.test(prompt) && !PULL_INTENT.test(prompt)) return;

      if (!truth || truth.mode !== "github-file") {
        setState("Brainstorming");
        onProof?.(`builder-agent: brainstorming against the shared preview — ${prompt}`);
        window.dispatchEvent(new CustomEvent(BUILDER_CONTEXT_EVENT, { detail: { kind: "brainstorm-command", prompt, sessionId: resolvedSessionId, projectId: detail.projectId || "", route } }));
        window.dispatchEvent(new CustomEvent("streams-builder-summary-event", { detail: { phase: "builder.agent.brainstorm", message: "Working in preview-only brainstorm mode. GitHub writes remain disabled because no repository target is locked." } }));
        return;
      }

      const target = { repo: file.repo, branch: file.branch, filePath: file.path, sourceSha: file.sha, lockToken: truth.lockToken };
      if (!targetMatchesSourceTruth(truth, target)) {
        const message = "Source lock mismatch. Autonomous GitHub access failed closed. Re-pull the visible repository target before continuing.";
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
              "The visible source lock below is the only authorized GitHub target.",
              `Locked repository: ${truth.repo}`,
              `Locked branch: ${truth.branch}`,
              `Locked file: ${truth.filePath}`,
              `Expected source SHA: ${truth.sourceSha}`,
              `Lock token: ${truth.lockToken}`,
              selectedRange ? `Visible selected lines: ${selectedRange.startLine}-${selectedRange.endLine}` : "No line range is selected; inspect the locked file and choose the smallest causal range.",
              "Pull the exact branch into a fresh isolated workspace. Never force push, never rewrite history, never use git add dot, and never touch an unlisted file.",
              "Before mutation, fail closed if repository, branch, path, lock token, or expected source SHA is stale or mismatched.",
              "Make the smallest causal change, run build and browser proof, stage only the locked file, commit, and push with a normal fast-forward update.",
              "If any proof fails, repair and retest up to the bounded attempt limit. Do not push unverified code.",
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
