"use client";

import { useState } from "react";

type CheckResult = {
  id: string;
  status: "passed" | "failed" | "blocked" | "not_tested";
  detail: string;
  evidence?: Record<string, unknown>;
};

type CommissioningReport = {
  ok: boolean;
  action: string;
  testedAt: string;
  administrator?: {
    email: string | null;
    role: string;
    workspaceName: string | null;
  };
  summary: {
    passed: number;
    failed: number;
    blocked: number;
    notTested: number;
  };
  results: CheckResult[];
  error?: string;
};

const statusLabel: Record<CheckResult["status"], string> = {
  passed: "Passed",
  failed: "Failed",
  blocked: "Blocked",
  not_tested: "Not tested",
};

export default function OperationsDashboardClient() {
  const [report, setReport] = useState<CommissioningReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [nonce, setNonce] = useState("");
  const [error, setError] = useState("");

  async function run(action: "status" | "persistence_start" | "persistence_check") {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/commissioning", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          expectedNonce: action === "persistence_check" ? nonce : undefined,
        }),
      });
      const payload = (await response.json()) as CommissioningReport;
      if (!response.ok) throw new Error(payload.error || "Commissioning request failed");
      setReport(payload);
      const persistence = payload.results?.find((item) => item.id === "builder-persistence-write");
      const nextNonce = persistence?.evidence?.nonce;
      if (typeof nextNonce === "string") setNonce(nextNonce);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Commissioning request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0c0c12", color: "#f7f7fb", padding: "32px" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <p style={{ margin: 0, color: "#a9a9b8", fontSize: 13, letterSpacing: 1.2, textTransform: "uppercase" }}>Streams Administration</p>
        <h1 style={{ margin: "8px 0 8px", fontSize: 34 }}>Infrastructure Operations</h1>
        <p style={{ margin: "0 0 24px", color: "#b8b8c7" }}>Commission the Vercel control plane, Railway Builder Worker, persistent workspace, and Provider Gateway using your authenticated administrator session.</p>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
          <button disabled={loading} onClick={() => run("status")} style={buttonStyle}>Run health report</button>
          <button disabled={loading} onClick={() => run("persistence_start")} style={buttonStyle}>Start persistence test</button>
          <button disabled={loading || !nonce} onClick={() => run("persistence_check")} style={buttonStyle}>Verify after restart</button>
        </div>

        {nonce ? (
          <div style={panelStyle}>
            <strong>Persistence nonce saved</strong>
            <p style={{ marginBottom: 0, color: "#b8b8c7" }}>Restart the Railway Builder Worker, wait for it to return online, then click “Verify after restart.”</p>
          </div>
        ) : null}

        {error ? <div style={{ ...panelStyle, borderColor: "#7b2d35", color: "#ffb4bc" }}>{error}</div> : null}

        {report ? (
          <>
            <section style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, margin: "24px 0" }}>
              {Object.entries(report.summary).map(([key, value]) => (
                <div key={key} style={panelStyle}>
                  <div style={{ color: "#9999aa", fontSize: 12, textTransform: "uppercase" }}>{key.replace(/([A-Z])/g, " $1")}</div>
                  <div style={{ fontSize: 28, marginTop: 6 }}>{value}</div>
                </div>
              ))}
            </section>

            <section style={{ display: "grid", gap: 12 }}>
              {report.results.map((result) => (
                <article key={result.id} style={panelStyle}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                    <strong>{result.id}</strong>
                    <span style={{ color: statusColor(result.status), fontWeight: 700 }}>{statusLabel[result.status]}</span>
                  </div>
                  <p style={{ color: "#b8b8c7", marginBottom: result.evidence ? 12 : 0 }}>{result.detail}</p>
                  {result.evidence ? (
                    <pre style={{ overflowX: "auto", background: "#111119", padding: 12, borderRadius: 8, color: "#cfcfe0", fontSize: 12 }}>{JSON.stringify(result.evidence, null, 2)}</pre>
                  ) : null}
                </article>
              ))}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}

const buttonStyle = {
  appearance: "none" as const,
  border: "1px solid #48485b",
  borderRadius: 9,
  background: "#20202c",
  color: "#fff",
  padding: "11px 15px",
  fontWeight: 700,
  cursor: "pointer",
};

const panelStyle = {
  border: "1px solid #2d2d3c",
  borderRadius: 12,
  background: "#15151e",
  padding: 16,
};

function statusColor(status: CheckResult["status"]) {
  if (status === "passed") return "#67d99b";
  if (status === "failed") return "#ff7e88";
  if (status === "blocked") return "#ffc36a";
  return "#aaaabd";
}
