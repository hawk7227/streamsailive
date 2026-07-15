"use client";

import React, { useEffect, useMemo, useState } from "react";
import { sanitizeStreamsAIPayload, sanitizeStreamsAIText } from "@/lib/streams-ai/protected-reasoning";

const STORAGE_KEY = "streams-ai.active-work-job.v1";
const CHANNEL_NAME = "streams-ai-work-history-v1";
const TERMINAL = new Set(["completed", "failed", "cancelled", "blocked"]);

function currentSessionId() {
  if (typeof window === "undefined") return "";
  const segments = window.location.pathname.split("/").filter(Boolean);
  return segments[0] === "streams-ai" && segments[1] ? segments[1] : "";
}

function readStoredJob() {
  try { return sanitizeStreamsAIPayload(JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null")); }
  catch { return null; }
}

function writeStoredJob(value) {
  if (!value?.jobId) return;
  const payload = sanitizeStreamsAIPayload({ ...value, announcedAt: Date.now() });
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  window.dispatchEvent(new CustomEvent("streams-ai:work-job", { detail: payload }));
  try {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage(payload);
    channel.close();
  } catch {}
}

function eventText(event) {
  return sanitizeStreamsAIText(event?.message || event?.data?.currentAction || event?.event_type || "Activity", 2000);
}

function statusLabel(status) {
  return String(status || "running").replace(/_/g, " ");
}

function listText(items) {
  return Array.isArray(items) ? items.map((item) => sanitizeStreamsAIText(typeof item === "string" ? item : item?.label || item?.id || "")).filter(Boolean) : [];
}

function progressFromEvent(event, job) {
  const source = event?.data?.progressUpdate || event?.data || {};
  const evidence = source.evidence || {};
  return {
    goal: sanitizeStreamsAIText(source.goal || job?.input_json?.goal || "Complete the accepted Streams task.", 500),
    completedWork: listText(source.completedWork || source.completedItems),
    currentAction: sanitizeStreamsAIText(source.currentAction || eventText(event), 1000),
    evidenceSummary: sanitizeStreamsAIText(evidence.summary || source.evidenceSummary || eventText(event), 1000),
    evidenceLevel: sanitizeStreamsAIText(evidence.level || source.evidenceLevel || "runtime observed", 120),
    verificationState: sanitizeStreamsAIText(evidence.verificationState || source.verificationState || "in progress", 120),
    nextAction: sanitizeStreamsAIText(source.nextAction || "Continue the accepted work plan.", 1000),
    remainingWork: listText(source.remainingWork || source.remainingItems),
  };
}

export default function StreamsAIWorkHistoryBridge() {
  const [active, setActive] = useState(null);
  const [record, setRecord] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState("");
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    const initial = readStoredJob();
    if (initial?.jobId) setActive(initial);

    const apply = (payload) => {
      const clean = sanitizeStreamsAIPayload(payload || {});
      if (!clean?.jobId) return;
      setActive((current) => !current || Number(clean.announcedAt || 0) >= Number(current.announcedAt || 0) ? clean : current);
    };
    const custom = (event) => apply(event.detail);
    const storage = (event) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try { apply(JSON.parse(event.newValue)); } catch {}
    };
    let channel = null;
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event) => apply(event.data);
    } catch {}
    window.addEventListener("streams-ai:work-job", custom);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener("streams-ai:work-job", custom);
      window.removeEventListener("storage", storage);
      channel?.close?.();
    };
  }, []);

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    if (window.__streamsAIWorkHistoryFetchInstalled) return undefined;
    window.__streamsAIWorkHistoryFetchInstalled = true;
    window.fetch = async (input, init = {}) => {
      const response = await originalFetch(input, init);
      const url = typeof input === "string" ? input : input?.url || "";
      const method = String(init?.method || "GET").toUpperCase();
      if (method === "POST" && url.includes("/api/streams-ai/messages")) {
        const jobId = response.headers.get("x-streams-ai-job-id");
        if (jobId) writeStoredJob({ jobId, sessionId: currentSessionId() });
      }
      return response;
    };
    return () => {
      window.fetch = originalFetch;
      window.__streamsAIWorkHistoryFetchInstalled = false;
    };
  }, []);

  useEffect(() => {
    if (active?.jobId) return;
    const sessionId = currentSessionId();
    if (!sessionId) return;
    fetch(`/api/streams-ai/jobs?sessionId=${encodeURIComponent(sessionId)}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        const latest = Array.isArray(data?.jobs) ? data.jobs.find((job) => job?.input_json?.purpose === "streams_ai_chat_operation") : null;
        if (latest?.id) writeStoredJob({ jobId: latest.id, sessionId });
      })
      .catch(() => null);
  }, [active?.jobId]);

  useEffect(() => {
    if (!active?.jobId) return undefined;
    let disposed = false;
    let timer = null;
    const load = async () => {
      try {
        const response = await fetch(`/api/streams-ai/jobs?jobId=${encodeURIComponent(active.jobId)}`, { cache: "no-store" });
        const data = sanitizeStreamsAIPayload(await response.json().catch(() => ({})));
        if (!response.ok || data?.ok === false) throw new Error(data?.error || "Could not restore work history.");
        if (disposed) return;
        setRecord(data);
        setError("");
        if (!TERMINAL.has(String(data?.job?.status || ""))) timer = window.setTimeout(load, 1600);
      } catch (loadError) {
        if (disposed) return;
        setError(sanitizeStreamsAIText(loadError?.message || "Could not restore work history."));
        timer = window.setTimeout(load, 3500);
      }
    };
    load();
    return () => { disposed = true; if (timer) window.clearTimeout(timer); };
  }, [active?.jobId]);

  const events = useMemo(() => Array.isArray(record?.events) ? record.events : [], [record]);
  const planEvent = useMemo(() => events.find((event) => event?.event_type === "plan_created") || null, [events]);
  if (!active?.jobId) return null;
  const job = record?.job;
  const status = String(job?.status || "running");
  const latest = events[events.length - 1];
  const canStop = !TERMINAL.has(status);
  const plan = planEvent?.data || job?.input_json || {};
  const goal = sanitizeStreamsAIText(plan.goal || job?.input_json?.goal || "Streams operation", 500);
  const phases = listText(plan.phases || job?.input_json?.phases);
  const preserved = listText(plan.preservedItems || job?.input_json?.preservedItems);
  const risks = listText(plan.risksAvoided || job?.input_json?.risksAvoided);
  const latestProgress = progressFromEvent(latest, job);

  const stop = async () => {
    if (!canStop || stopping) return;
    setStopping(true);
    try {
      const response = await fetch("/api/streams-ai/jobs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: active.jobId, action: "cancel" }),
      });
      const data = sanitizeStreamsAIPayload(await response.json().catch(() => ({})));
      if (!response.ok || data?.ok === false) throw new Error(data?.error || "Could not stop the operation.");
      setRecord((current) => ({ ...(current || {}), job: data.job || current?.job, events: data.event ? [...(current?.events || []), data.event] : current?.events || [] }));
    } catch (stopError) {
      setError(sanitizeStreamsAIText(stopError?.message || "Could not stop the operation."));
    } finally {
      setStopping(false);
    }
  };

  return (
    <aside className={`streamsAIWorkHistory streamsAIWorkHistory--${status}`} aria-label="Streams work activity" role="status">
      <div className="streamsAIWorkHistory__bar">
        <button type="button" className="streamsAIWorkHistory__summary" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
          <span className="streamsAIWorkHistory__dot" aria-hidden="true" />
          <span className="streamsAIWorkHistory__copy">
            <strong>{goal || job?.input_json?.capability?.displayName || "Streams activity"}</strong>
            <small>{latestProgress.currentAction || error || "Restoring activity…"}</small>
          </span>
          <span className="streamsAIWorkHistory__status">{statusLabel(status)}</span>
        </button>
        {canStop && <button type="button" className="streamsAIWorkHistory__stop" onClick={stop} disabled={stopping} aria-label="Stop current Streams operation">{stopping ? "Stopping…" : "Stop"}</button>}
      </div>
      {expanded && (
        <div className="streamsAIWorkHistory__events" role="log" aria-live={TERMINAL.has(status) ? "polite" : "off"}>
          {error && <div className="streamsAIWorkHistory__event streamsAIWorkHistory__event--error">{error}</div>}
          <section className="streamsAIWorkHistory__progress" aria-label="Current structured progress update">
            <p><strong>Goal:</strong> {latestProgress.goal}</p>
            <p><strong>Completed:</strong> {latestProgress.completedWork.length ? latestProgress.completedWork.join(" · ") : "No completed phase recorded yet."}</p>
            <p><strong>Now:</strong> {latestProgress.currentAction}</p>
            <p><strong>Evidence:</strong> {latestProgress.evidenceSummary} <span>({statusLabel(latestProgress.evidenceLevel)} · {statusLabel(latestProgress.verificationState)})</span></p>
            <p><strong>Next:</strong> {latestProgress.nextAction}</p>
          </section>
          {(phases.length > 0 || preserved.length > 0 || risks.length > 0) && (
            <section className="streamsAIWorkHistory__plan" aria-label="Accepted work plan">
              {phases.length > 0 && <p><strong>Plan:</strong> {phases.join(" → ")}</p>}
              {preserved.length > 0 && <p><strong>Preserving:</strong> {preserved.join(" · ")}</p>}
              {risks.length > 0 && <p><strong>Avoiding:</strong> {risks.join(" · ")}</p>}
            </section>
          )}
          {events.map((event) => {
            const progress = progressFromEvent(event, job);
            return (
              <article key={event.id} className={`streamsAIWorkHistory__event streamsAIWorkHistory__event--${event?.data?.status || status}`}>
                <div className="streamsAIWorkHistory__eventHead"><strong>{statusLabel(event.event_type)}</strong><time dateTime={event.created_at}>{event.created_at ? new Date(event.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""}</time></div>
                <p>{eventText(event)}</p>
                <small>Now: {progress.currentAction}</small>
                <small>Evidence: {progress.evidenceSummary}</small>
                <small>Next: {progress.nextAction}</small>
                {progress.completedWork.length > 0 && <small>Completed: {progress.completedWork.join(" · ")}</small>}
              </article>
            );
          })}
        </div>
      )}
      <style jsx>{`
        .streamsAIWorkHistory{position:fixed;left:50%;bottom:118px;transform:translateX(-50%);width:min(780px,calc(100vw - 72px));z-index:246;border:1px solid rgba(15,23,42,.12);border-radius:16px;background:rgba(255,255,255,.97);box-shadow:0 14px 40px rgba(15,23,42,.12);overflow:hidden;color:#0f172a}
        .streamsAIWorkHistory__bar{display:flex;align-items:center}.streamsAIWorkHistory__summary{flex:1;min-width:0;border:0;background:transparent;padding:12px 14px;display:flex;align-items:center;gap:10px;text-align:left}.streamsAIWorkHistory__dot{width:9px;height:9px;border-radius:50%;background:#2563eb;box-shadow:0 0 0 4px rgba(37,99,235,.12);flex:none}.streamsAIWorkHistory--completed .streamsAIWorkHistory__dot{background:#16a34a}.streamsAIWorkHistory--failed .streamsAIWorkHistory__dot,.streamsAIWorkHistory--blocked .streamsAIWorkHistory__dot{background:#dc2626}.streamsAIWorkHistory__copy{display:flex;flex-direction:column;min-width:0;flex:1}.streamsAIWorkHistory__copy strong{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.streamsAIWorkHistory__copy small{font-size:12px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.streamsAIWorkHistory__status{font-size:11px;text-transform:capitalize;border:1px solid #e2e8f0;border-radius:999px;padding:4px 8px}.streamsAIWorkHistory__stop{margin-right:10px;min-height:34px;border:1px solid #fecaca;background:#fff;color:#b91c1c;border-radius:10px;padding:0 11px}.streamsAIWorkHistory__events{border-top:1px solid #e2e8f0;max-height:320px;overflow:auto;padding:9px 12px;display:flex;flex-direction:column;gap:8px}.streamsAIWorkHistory__progress,.streamsAIWorkHistory__plan{border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;padding:8px 10px}.streamsAIWorkHistory__progress p,.streamsAIWorkHistory__plan p{margin:4px 0;font-size:12px;line-height:1.45;color:#475569}.streamsAIWorkHistory__progress span{color:#64748b}.streamsAIWorkHistory__event{border-left:2px solid #cbd5e1;padding:6px 9px;display:flex;flex-direction:column;gap:2px}.streamsAIWorkHistory__event--failed,.streamsAIWorkHistory__event--error{border-left-color:#dc2626}.streamsAIWorkHistory__eventHead{display:flex;justify-content:space-between;gap:12px}.streamsAIWorkHistory__eventHead strong{font-size:12px}.streamsAIWorkHistory__eventHead time,.streamsAIWorkHistory__event small{font-size:11px;color:#64748b}.streamsAIWorkHistory__event p{margin:3px 0;font-size:13px;line-height:1.4}
        @media(max-width:700px){.streamsAIWorkHistory{bottom:104px;width:calc(100vw - 24px);border-radius:14px}.streamsAIWorkHistory__status{max-width:86px;overflow:hidden;text-overflow:ellipsis}.streamsAIWorkHistory__events{max-height:250px}.streamsAIWorkHistory__copy strong{font-size:13px}.streamsAIWorkHistory__progress p{font-size:11.5px}}
        @media(prefers-reduced-motion:reduce){.streamsAIWorkHistory *{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
      `}</style>
    </aside>
  );
}
