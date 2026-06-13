"use client";

import { useEffect, useMemo, useState } from "react";

type ReadinessState = "ready" | "partial" | "missing" | "disabled";

type CapabilityReadiness = {
  id: string;
  label: string;
  group: string;
  state: ReadinessState;
  enabled: boolean;
  satisfied: string[];
  missing: string[];
  optionalMissing: string[];
};

type EnvReadinessReport = {
  ok: boolean;
  generatedAt: string;
  groups: Record<string, { ok: boolean; items: CapabilityReadiness[] }>;
  capabilities: CapabilityReadiness[];
};

type EnvReadinessResponse = {
  ok: boolean;
  report?: EnvReadinessReport;
  error?: string;
};

const GROUP_ORDER = ["chat", "builder", "admingeneration", "voice", "storage", "auth"];

function stateRank(state: ReadinessState) {
  if (state === "missing") return 3;
  if (state === "partial") return 2;
  if (state === "disabled") return 1;
  return 0;
}

function toneForState(state: ReadinessState) {
  if (state === "ready") return "ready";
  if (state === "partial") return "partial";
  if (state === "disabled") return "disabled";
  return "missing";
}

function normalizeState(items: CapabilityReadiness[]): ReadinessState {
  if (!items.length) return "disabled";
  return items.reduce<ReadinessState>((current, item) =>
    stateRank(item.state) > stateRank(current) ? item.state : current,
  "ready");
}

export default function EnvReadinessMonitor() {
  const [data, setData] = useState<EnvReadinessResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/streams-builder/env-readiness", {
        cache: "no-store",
      });
      const json = (await response.json().catch(() => null)) as EnvReadinessResponse | null;
      if (!response.ok || !json) {
        throw new Error(json?.error || `Readiness request failed: ${response.status}`);
      }
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load env readiness.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const report = data?.report || null;
  const groups = useMemo(() => {
    if (!report) return [];
    return GROUP_ORDER.map((key) => ({ key, value: report.groups[key] })).filter((entry) => entry.value);
  }, [report]);

  const overallState: ReadinessState = report?.ok ? "ready" : "missing";

  return (
    <section className="envMonitor">
      <header className="envHead">
        <div>
          <b>ENV READINESS</b>
          <span>Server-side capability checks only. No secret values shown.</span>
        </div>
        <button type="button" onClick={load}>Refresh</button>
      </header>

      {loading ? (
        <div className="notice">Loading readiness…</div>
      ) : error ? (
        <div className="notice error">{error}</div>
      ) : report ? (
        <div className="envBody">
          <div className={`overall ${toneForState(overallState)}`}>
            <strong>{overallState.toUpperCase()}</strong>
            <small>{report.generatedAt ? new Date(report.generatedAt).toLocaleString() : "fresh check"}</small>
          </div>

          <div className="groupGrid">
            {groups.map(({ key, value }) => {
              const groupState = normalizeState(value.items);
              return (
                <article className={`groupCard ${toneForState(groupState)}`} key={key}>
                  <div className="groupTop">
                    <strong>{key}</strong>
                    <em>{groupState}</em>
                  </div>
                  <div className="capList">
                    {value.items.map((item) => (
                      <div className="capRow" key={item.id}>
                        <span>{item.label}</span>
                        <i className={toneForState(item.state)}>{item.state}</i>
                        {item.missing.length > 0 ? (
                          <small>Missing: {item.missing.join(", ")}</small>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="notice">No readiness data returned.</div>
      )}

      <style jsx>{`
        .envMonitor {
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 12px;
          background: rgba(2, 6, 23, 0.64);
          color: #fff;
          overflow: hidden;
          font-size: 11px;
        }

        .envHead {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 8px;
          padding: 10px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.12);
        }

        .envHead b {
          display: block;
          color: #67e8f9;
          font-size: 10px;
          letter-spacing: 0.06em;
        }

        .envHead span {
          display: block;
          color: #94a3b8;
          margin-top: 2px;
          line-height: 1.25;
        }

        .envHead button {
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 8px;
          background: rgba(124, 58, 237, 0.22);
          color: #fff;
          padding: 6px 8px;
          font-size: 10px;
          font-weight: 800;
          cursor: pointer;
        }

        .notice {
          padding: 10px;
          color: #cbd5e1;
        }

        .notice.error {
          color: #fca5a5;
        }

        .envBody {
          padding: 10px;
          display: grid;
          gap: 10px;
        }

        .overall {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          border-radius: 10px;
          padding: 8px;
          border: 1px solid rgba(148, 163, 184, 0.16);
          background: rgba(15, 23, 42, 0.8);
        }

        .overall strong {
          font-size: 11px;
        }

        .overall small {
          color: #94a3b8;
          font-size: 9px;
        }

        .groupGrid {
          display: grid;
          gap: 8px;
        }

        .groupCard {
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 10px;
          background: rgba(15, 23, 42, 0.62);
          padding: 8px;
        }

        .groupCard.ready {
          border-color: rgba(74, 222, 128, 0.24);
        }

        .groupCard.partial,
        .overall.partial {
          border-color: rgba(251, 191, 36, 0.3);
        }

        .groupCard.missing,
        .overall.missing {
          border-color: rgba(248, 113, 113, 0.32);
        }

        .groupTop {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 6px;
        }

        .groupTop strong {
          color: #e2e8f0;
          text-transform: uppercase;
          font-size: 10px;
        }

        .groupTop em,
        .capRow i {
          font-style: normal;
          border-radius: 999px;
          padding: 2px 6px;
          font-size: 9px;
          font-weight: 900;
          background: rgba(148, 163, 184, 0.12);
          color: #cbd5e1;
        }

        .groupTop em.ready,
        .capRow i.ready {
          background: rgba(34, 197, 94, 0.16);
          color: #86efac;
        }

        .groupTop em.partial,
        .capRow i.partial {
          background: rgba(245, 158, 11, 0.16);
          color: #fcd34d;
        }

        .groupTop em.missing,
        .capRow i.missing {
          background: rgba(239, 68, 68, 0.16);
          color: #fca5a5;
        }

        .capList {
          display: grid;
          gap: 5px;
        }

        .capRow {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 6px;
          align-items: center;
          color: #cbd5e1;
          line-height: 1.25;
        }

        .capRow span {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .capRow small {
          grid-column: 1 / -1;
          color: #fca5a5;
          font-size: 9px;
          line-height: 1.25;
          word-break: break-word;
        }
      `}</style>
    </section>
  );
}
