"use client";

import { useEffect, useRef, useState } from "react";
import type { PulledFileDetail } from "./builderSystemContract";
import { isFileConfirmation } from "./builderSourceDiscovery";
import { emitBuilderAgentCommunication } from "./builderAgentInteraction";
import { BUILDER_AGENT_FOCUS_EVENT, BUILDER_CONTEXT_EVENT, readBuilderSourceTruth, targetMatchesSourceTruth, writeBuilderSourceTruth, type BuilderSelectionRange } from "./builderLiveSourceTruth";
import { createBuilderCognitivePlan, formatBuilderCognitivePlan } from "@/lib/streams-builder/builder-cognitive-orchestrator";

type Props = { activeFile: PulledFileDetail; sessionId?: string; onProof?: (message: string) => void };
type ChatCommandDetail = { message?: string; prompt?: string; sessionId?: string; projectId?: string; conversation?: string[]; screenshotText?: string; visibleText?: string; route?: string; references?: string[] };
type ExecutionResponse = { ok?: boolean; error?: string; queuedJob?: { id?: string }; plan?: { blockedReasons?: string[] } };
type EditorStateDetail = { repo?: string; branch?: string; filePath?: string; sha?: string; selection?: BuilderSelectionRange | null };

const BUILD_INTENT = /\b(build|create|implement|change|edit|update|fix|repair|debug|troubleshoot|refactor|redesign|replace|remove|add|connect|wire|test|verify|deploy|preview|frontend|backend|api|database|component|page|route|code|push|commit|publish|audit|research|analyze)\b/i;
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
      const cognitivePlan = createBuilderCognitivePlan({
        prompt,
        lockedFile: truth?.mode === "github-file" ? truth.filePath : "",
        route,
        hasPreview: Boolean(route && route !== "/"),
        hasRepositoryLock: truth?.mode === "github-file",
      });
      window.dispatchEvent(new CustomEvent(BUILDER_CONTEXT_EVENT, { detail: { kind: "cognitive-plan", prompt, cognitivePlan } }));

      if (isFileConfirmation(prompt)) {
        setState("Locking confirmed file");
        window.dispatchEvent(new CustomEvent("streams-builder:lock-candidate", { detail: { prompt } }));
        return;
      }

      const explicitDiscovery = DISCOVERY_INTENT.test(prompt) && (!BUILD_INTENT.test(prompt) || /\b(open|pull|show|find|locate|which file|this screen|screenshot)\b/i.test(prompt));
      if (explicitDiscovery || (!truth || truth.mode !== "github-file") && DISCOVERY_INTENT.test(prompt)) {
        setState("Locating source");
        emitBuilderAgentCommunication({
          phase: "github.discovery.started",
          message: "Locating the most likely source",
          detail: `Using conversation, screen evidence, route, references and repository structure. Risk ${cognitivePlan.risk}; uncertainty ${cognitivePlan.uncertainty.toFixed(2)}.`,
          status: "working",
          view: "frontend",
          reason: "The candidate must be displayed for visual confirmation before any editing authority is granted.",
        });
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
          cognitivePlan,
        } }));
        return;
      }

      if (!BUILD_INTENT.test(prompt)) return;

      if (!truth || truth.mode !== "github-file") {
        setState("Source confirmation required");
        const question = cognitivePlan.clarificationQuestions[0] || "Which source candidate should I locate and open for confirmation?";
        emitBuilderAgentCommunication({
          phase: "builder.agent.source-required",
          message: question,
          detail: "I may discover candidates broadly, but I cannot read for implementation, edit, build from, commit or push repository source until you confirm and lock the exact file.",
          status: "question",
          requiresResponse: true,
          view: "frontend",
          reason: "Source authorization is missing.",
        });
        return;
      }

      const target = { repo: file.repo, branch: file.branch, filePath: file.path, sourceSha: file.sha, lockToken: truth.lockToken };
      if (!targetMatchesSourceTruth(truth, target)) {
        const message = "Source lock mismatch. Autonomous GitHub access failed closed. Re-open and confirm the visible repository target before continuing.";
        setState("Blocked · source changed");
        onProof?.(`builder-agent-error: ${message}`);
        emitBuilderAgentCommunication({ phase: "builder.agent.source-lock-blocked", message, status: "error", view: "logs", reason: "Repository capability no longer matches visible source truth." });
        return;
      }

      runningRef.current = true;
      const selectedRange = selectionRef.current || truth.selectedRange || null;
      setState(`Autonomous · ${truth.filePath}`);
      emitBuilderAgentCommunication({
        phase: "builder.plan.created",
        message: `Planning ${cognitivePlan.taskKinds.join(", ")} work`,
        detail: `Risk ${cognitivePlan.risk}; required evidence: ${cognitivePlan.requiredEvidence.join(", ")}.`,
        status: cognitivePlan.risk === "critical" ? "warning" : "working",
        view: "logs",
        reason: "The agent is establishing evidence, scope and stop conditions before execution.",
        filePath: truth.filePath,
      });
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
              "Treat this cognitive plan as an execution and evidence contract:",
              formatBuilderCognitivePlan(cognitivePlan),
              "The confirmed source lock below is the only repository content you are authorized to read or change.",
              `Locked repository: ${truth.repo}`,
              `Locked branch: ${truth.branch}`,
              `Locked file: ${truth.filePath}`,
              `Expected source SHA: ${truth.sourceSha}`,
              `Lock token: ${truth.lockToken}`,
              selectedRange ? `Visible selected lines: ${selectedRange.startLine}-${selectedRange.endLine}` : "No line range is selected; inspect the locked file and choose the smallest causal range.",
              "Use independent evidence from source, build output, browser telemetry, DOM state, requested behavior and repository state. Preserve uncertainty instead of inventing success.",
              "Never read an unlisted file. A filename in an import, error, stack trace, build log or search result is evidence, not authorization.",
              "If another file appears necessary, stop before reading it and emit a source-scope request naming the exact reason and likely path. Wait for user-granted discovery and confirmation.",
              "Pull the exact branch into an isolated workspace. Never force push, rewrite history, switch branches, use git add dot, or stage an unlisted path.",
              "Before mutation, fail closed if repository, branch, path, lock token, or expected source SHA is stale or mismatched.",
              "Decompose complicated requests into observable phases, use the smallest sufficient tools, and re-plan when evidence contradicts the current hypothesis.",
              "Make the smallest causal change, run focused checks plus build and browser proof where applicable, stage only the locked file, commit, and push with a normal fast-forward update.",
              "If proof fails, repair and retest up to the bounded attempt limit. Do not push unverified code and do not report completion without artifact-bound evidence.",
              `User request: ${prompt}`,
            ].join("\n"),
            requestedCommands: ["clone_repo", "read_full_file", "npm_run_build", "git_status", "git_diff", "git_add_specific_file", "git_commit", "git_push"],
            targetFiles: [truth.filePath],
            commitMessage: `Streams AI: ${prompt.slice(0, 120)}`,
            sourceTruth: { ...truth, sessionId: resolvedSessionId, projectId: detail.projectId || "streams-live-builder" },
            cognitivePlan,
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
        window.dispatchEvent(new CustomEvent("streams-builder:runtime-job", { detail: { jobId, repo: truth.repo, branch: truth.branch, path: truth.filePath, sha: truth.sourceSha, lockToken: truth.lockToken, route, prompt, selectedRange, autonomousGitHub: true, cognitivePlan } }));
        window.dispatchEvent(new CustomEvent(BUILDER_AGENT_FOCUS_EVENT, { detail: { repo: truth.repo, branch: truth.branch, filePath: truth.filePath, sourceSha: truth.sourceSha, selectedRange, phase: "working", jobId } }));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Builder agent command failed.";
        setState(`Blocked · ${message}`);
        onProof?.(`builder-agent-error: ${message}`);
        emitBuilderAgentCommunication({ phase: "builder.agent.failed", message, status: "error", view: "logs", reason: "Execution did not satisfy the cognitive plan and source-truth contract." });
      } finally {
        runningRef.current = false;
      }
    }

    window.addEventListener("streams:authoritative-chat-command", onCommand);
    return () => window.removeEventListener("streams:authoritative-chat-command", onCommand);
  }, [onProof]);

  return <span className="builderAgentA11yState" aria-live="polite">{state}<style jsx>{`.builderAgentA11yState{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}`}</style></span>;
}
