"use client";

import { useEffect, useRef } from "react";
import type { PulledFileDetail } from "./builderSystemContract";

type Props = { activeFile: PulledFileDetail; sessionId?: string; onProof?: (message: string) => void };
type Telemetry = { type?: string; level?: string; message?: string; args?: unknown[]; url?: string; status?: number; snapshot?: unknown; element?: unknown; at?: string };
type CommandDetail = { message?: string; prompt?: string; autonomous?: boolean };

const BUILD_INTENT = /\b(build|create|implement|change|edit|update|fix|repair|debug|troubleshoot|refactor|redesign|replace|remove|add|connect|wire|test|verify|preview|frontend|component|page|route|code)\b/i;
const FAILURE = /error|exception|failed|rejection|uncaught|hydration|500|404|network/i;
const VERIFY_DELAY_MS = 4500;
const REPAIR_WATCHDOG_MS = 20000;

function text(value: unknown) {
  if (typeof value === "string") return value;
  try { return JSON.stringify(value); } catch { return String(value); }
}

function isFailure(item: Telemetry) {
  return item.type === "error" || item.level === "error" || (item.status || 0) >= 400 || FAILURE.test(text(item.message || item.args || ""));
}

export default function BuilderAutonomousTroubleshootingLoop({ activeFile, sessionId, onProof }: Props) {
  const armed = useRef(false);
  const attempts = useRef(0);
  const originalPrompt = useRef("");
  const evidence = useRef<Telemetry[]>([]);
  const verifyTimer = useRef<number | null>(null);
  const repairWatchdog = useRef<number | null>(null);
  const repairInFlight = useRef(false);
  const activeFileRef = useRef(activeFile);

  useEffect(() => { activeFileRef.current = activeFile; }, [activeFile]);

  useEffect(() => {
    function clearVerifyTimer() {
      if (verifyTimer.current) window.clearTimeout(verifyTimer.current);
      verifyTimer.current = null;
    }

    function clearRepairWatchdog() {
      if (repairWatchdog.current) window.clearTimeout(repairWatchdog.current);
      repairWatchdog.current = null;
    }

    function stopLoop(reason: string) {
      armed.current = false;
      repairInFlight.current = false;
      clearVerifyTimer();
      clearRepairWatchdog();
      window.dispatchEvent(new CustomEvent("streams-builder-summary-event", { detail: { phase: "builder.autonomous.stopped", message: reason } }));
    }

    function scheduleVerification() {
      clearVerifyTimer();
      if (!armed.current || repairInFlight.current) return;
      verifyTimer.current = window.setTimeout(() => {
        const recent = evidence.current.slice(-60);
        const failures = recent.filter(isFailure);
        const hasSnapshot = recent.some((item) => item.type === "snapshot" || item.type === "dom-snapshot");
        if (failures.length || !hasSnapshot) return;
        armed.current = false;
        attempts.current = 0;
        onProof?.("Autonomous verification passed: preview settled with DOM evidence and no recent browser failures.");
        window.dispatchEvent(new CustomEvent("streams-builder-summary-event", { detail: { phase: "builder.autonomous.verified", message: "Browser verification passed. The preview DOM was captured and no recent console, resource, promise, or network failures remain." } }));
        window.dispatchEvent(new CustomEvent("streams-builder:autonomous-verification", { detail: { ok: true, evidence: recent, file: activeFileRef.current } }));
      }, VERIFY_DELAY_MS);
    }

    function dispatchRepair(failureText: string) {
      if (!armed.current || repairInFlight.current) return;
      attempts.current += 1;
      repairInFlight.current = true;
      clearVerifyTimer();

      const file = activeFileRef.current;
      const recent = evidence.current.slice(-30);
      const repairPrompt = [
        `Autonomous troubleshooting attempt ${attempts.current}. Continue until browser verification passes.`,
        `Original request: ${originalPrompt.current}`,
        `Observed failure: ${failureText}`,
        `Visible target: ${file.repo || "brainstorm-preview"}@${file.branch || "preview"}:${file.path || "generated preview"}#${file.sha || "runtime"}`,
        "Use only the visible shared source. Reproduce the failure, locate the causal lines, apply the smallest repair, show each changed line, refresh the same preview, and verify the failure is gone.",
        "Do not claim success without fresh browser and DOM evidence. Do not access GitHub unless a visible GitHub file lock is active.",
        `Recent browser evidence: ${text(recent).slice(0, 8000)}`,
      ].join("\n");

      onProof?.(`Autonomous repair attempt ${attempts.current}: ${failureText.slice(0, 180)}`);
      window.dispatchEvent(new CustomEvent("streams:authoritative-chat-command", { detail: { message: repairPrompt, sessionId: sessionId || "builder-live-session", autonomous: true, attempt: attempts.current } }));
      window.dispatchEvent(new CustomEvent("streams-builder-summary-event", { detail: { phase: "builder.autonomous.repair", message: `Automatic repair attempt ${attempts.current} started from browser evidence.` } }));

      clearRepairWatchdog();
      repairWatchdog.current = window.setTimeout(() => {
        if (!armed.current || !repairInFlight.current) return;
        repairInFlight.current = false;
        dispatchRepair(`Repair attempt ${attempts.current} produced no source update or verified preview within ${REPAIR_WATCHDOG_MS / 1000} seconds. Re-check the same failure and continue.`);
      }, REPAIR_WATCHDOG_MS);
    }

    function onCommand(event: Event) {
      const detail = (event as CustomEvent<CommandDetail>).detail || {};
      if (detail.autonomous) return;
      const prompt = String(detail.message || detail.prompt || "").trim();
      if (!prompt || !BUILD_INTENT.test(prompt)) return;
      armed.current = true;
      attempts.current = 0;
      originalPrompt.current = prompt;
      evidence.current = [];
      repairInFlight.current = false;
      clearRepairWatchdog();
      onProof?.("Autonomous troubleshooting armed. It will continue repairing until fresh browser and DOM verification passes.");
      scheduleVerification();
    }

    function onTelemetry(event: Event) {
      const detail = (event as CustomEvent<Telemetry>).detail || {};
      const item = { ...detail, at: detail.at || new Date().toISOString() };
      evidence.current = [...evidence.current.slice(-159), item];
      window.dispatchEvent(new CustomEvent("streams-builder:shared-context", { detail: { kind: "browser-telemetry", telemetry: detail, file: activeFileRef.current } }));

      if (!armed.current) return;
      if (isFailure(item)) {
        dispatchRepair(text(detail.message || detail.args || `${detail.status || ""} ${detail.url || ""}`));
        return;
      }
      scheduleVerification();
    }

    function onSourceChange() {
      if (!armed.current) return;
      repairInFlight.current = false;
      clearRepairWatchdog();
      evidence.current = [];
      onProof?.("Repair applied. Waiting for fresh browser and DOM verification.");
      scheduleVerification();
    }

    function onStop(event: Event) {
      const detail = (event as CustomEvent<{ reason?: string }>).detail;
      stopLoop(detail?.reason || "Autonomous troubleshooting stopped by user request.");
    }

    window.addEventListener("streams:authoritative-chat-command", onCommand);
    window.addEventListener("streams-builder:browser-telemetry", onTelemetry);
    window.addEventListener("streams-builder:shared-source-change", onSourceChange);
    window.addEventListener("streams-builder:autonomous-stop", onStop);
    return () => {
      clearVerifyTimer();
      clearRepairWatchdog();
      window.removeEventListener("streams:authoritative-chat-command", onCommand);
      window.removeEventListener("streams-builder:browser-telemetry", onTelemetry);
      window.removeEventListener("streams-builder:shared-source-change", onSourceChange);
      window.removeEventListener("streams-builder:autonomous-stop", onStop);
    };
  }, [onProof, sessionId]);

  return null;
}
