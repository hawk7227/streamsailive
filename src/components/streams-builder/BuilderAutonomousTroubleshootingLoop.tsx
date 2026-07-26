"use client";

import { useEffect, useRef } from "react";
import type { PulledFileDetail } from "./builderSystemContract";

type Props = { activeFile: PulledFileDetail; sessionId?: string; onProof?: (message: string) => void };
type Telemetry = { type?: string; level?: string; message?: string; args?: unknown[]; url?: string; status?: number; snapshot?: unknown; element?: unknown; at?: string };

const BUILD_INTENT = /\b(build|create|implement|change|edit|update|fix|repair|debug|troubleshoot|refactor|redesign|replace|remove|add|connect|wire|test|verify|preview|frontend|component|page|route|code)\b/i;
const FAILURE = /error|exception|failed|rejection|uncaught|hydration|500|404|network/i;
const MAX_ATTEMPTS = 5;

function text(value: unknown) {
  if (typeof value === "string") return value;
  try { return JSON.stringify(value); } catch { return String(value); }
}

export default function BuilderAutonomousTroubleshootingLoop({ activeFile, sessionId, onProof }: Props) {
  const armed = useRef(false);
  const attempts = useRef(0);
  const originalPrompt = useRef("");
  const lastFailure = useRef("");
  const evidence = useRef<Telemetry[]>([]);
  const verifyTimer = useRef<number | null>(null);
  const activeFileRef = useRef(activeFile);

  useEffect(() => { activeFileRef.current = activeFile; }, [activeFile]);

  useEffect(() => {
    function clearVerifyTimer() {
      if (verifyTimer.current) window.clearTimeout(verifyTimer.current);
      verifyTimer.current = null;
    }

    function scheduleVerification() {
      clearVerifyTimer();
      if (!armed.current) return;
      verifyTimer.current = window.setTimeout(() => {
        const recent = evidence.current.slice(-40);
        const failures = recent.filter((item) => item.type === "error" || item.level === "error" || (item.status || 0) >= 400 || FAILURE.test(text(item.message || item.args || "")));
        const hasSnapshot = recent.some((item) => item.type === "snapshot" || item.type === "dom-snapshot");
        if (failures.length || !hasSnapshot) return;
        armed.current = false;
        attempts.current = 0;
        onProof?.("Autonomous verification passed: preview settled with DOM evidence and no recent browser failures.");
        window.dispatchEvent(new CustomEvent("streams-builder-summary-event", { detail: { phase: "builder.autonomous.verified", message: "Browser verification passed. No recent console, resource, promise, or network failures were observed and the preview DOM was captured." } }));
        window.dispatchEvent(new CustomEvent("streams-builder:autonomous-verification", { detail: { ok: true, evidence: recent, file: activeFileRef.current } }));
      }, 4500);
    }

    function onCommand(event: Event) {
      const detail = (event as CustomEvent<{ message?: string; prompt?: string }>).detail || {};
      const prompt = String(detail.message || detail.prompt || "").trim();
      if (!prompt || !BUILD_INTENT.test(prompt)) return;
      armed.current = true;
      attempts.current = 0;
      originalPrompt.current = prompt;
      lastFailure.current = "";
      evidence.current = [];
      onProof?.("Autonomous troubleshooting armed. Waiting for runtime and browser evidence.");
      scheduleVerification();
    }

    function onTelemetry(event: Event) {
      const detail = (event as CustomEvent<Telemetry>).detail || {};
      evidence.current = [...evidence.current.slice(-119), { ...detail, at: detail.at || new Date().toISOString() }];
      window.dispatchEvent(new CustomEvent("streams-builder:shared-context", { detail: { kind: "browser-telemetry", telemetry: detail, file: activeFileRef.current } }));

      const failureText = text(detail.message || detail.args || `${detail.status || ""} ${detail.url || ""}`);
      const failed = detail.type === "error" || detail.level === "error" || (detail.status || 0) >= 400 || FAILURE.test(failureText);
      if (!armed.current || !failed) { scheduleVerification(); return; }
      if (failureText === lastFailure.current) return;
      lastFailure.current = failureText;
      clearVerifyTimer();

      if (attempts.current >= MAX_ATTEMPTS) {
        armed.current = false;
        onProof?.(`Autonomous troubleshooting stopped after ${MAX_ATTEMPTS} attempts.`);
        window.dispatchEvent(new CustomEvent("streams-builder-summary-event", { detail: { phase: "builder.autonomous.exhausted", message: `Troubleshooting stopped after ${MAX_ATTEMPTS} bounded attempts. User review is required.` } }));
        return;
      }

      attempts.current += 1;
      const file = activeFileRef.current;
      const recent = evidence.current.slice(-25);
      const repairPrompt = [
        `Autonomous troubleshooting attempt ${attempts.current} of ${MAX_ATTEMPTS}.`,
        `Original request: ${originalPrompt.current}`,
        `Observed failure: ${failureText}`,
        `Visible target: ${file.repo || "brainstorm-preview"}@${file.branch || "preview"}:${file.path || "generated preview"}#${file.sha || "runtime"}`,
        "Use only the visible shared source. Reproduce the failure, locate the causal lines, apply the smallest repair, show each changed line, refresh the same preview, and verify the failure is gone.",
        "Do not claim success without browser and DOM evidence. Do not access GitHub unless a visible GitHub file lock is active.",
        `Recent browser evidence: ${text(recent).slice(0, 8000)}`,
      ].join("\n");

      onProof?.(`Autonomous repair attempt ${attempts.current}: ${failureText.slice(0, 180)}`);
      window.dispatchEvent(new CustomEvent("streams:authoritative-chat-command", { detail: { message: repairPrompt, sessionId: sessionId || "builder-live-session", autonomous: true, attempt: attempts.current } }));
      window.dispatchEvent(new CustomEvent("streams-builder-summary-event", { detail: { phase: "builder.autonomous.repair", message: `Automatic repair attempt ${attempts.current}/${MAX_ATTEMPTS} started from browser evidence.` } }));
    }

    function onSourceChange() { if (armed.current) scheduleVerification(); }

    window.addEventListener("streams:authoritative-chat-command", onCommand);
    window.addEventListener("streams-builder:browser-telemetry", onTelemetry);
    window.addEventListener("streams-builder:shared-source-change", onSourceChange);
    return () => {
      clearVerifyTimer();
      window.removeEventListener("streams:authoritative-chat-command", onCommand);
      window.removeEventListener("streams-builder:browser-telemetry", onTelemetry);
      window.removeEventListener("streams-builder:shared-source-change", onSourceChange);
    };
  }, [onProof, sessionId]);

  return null;
}
