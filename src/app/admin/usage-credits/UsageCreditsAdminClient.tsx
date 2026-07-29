"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type UserUsage = {
  userId: string;
  planId: string;
  status: string;
  dailyUsed: number;
  dailyLimit: number;
  dailyAvailable: number;
  includedAvailable: number;
  paidAvailable: number;
  paidReceived: number;
  paidUsed: number;
  monthlySpendUsd: number;
  monthlySpendLimitUsd: number | null;
  updatedAt?: string;
};

type AdminUsageState = {
  ok?: boolean;
  generatedAt?: string;
  error?: string;
  totals?: {
    users?: number;
    activeUsersToday?: number;
    dailyCreditsUsed?: number;
    includedCreditsAvailable?: number;
    paidCreditsAvailable?: number;
    monthlySpendUsd?: number;
    purchaseRevenueUsd?: number;
  };
  users?: UserUsage[];
  highestUsage?: UserUsage[];
  highestSpend?: UserUsage[];
  ledger?: Array<{ user_id?: string; reason?: string; ledger_type?: string; amount?: number; balance_after?: number; feature_key?: string; stage?: string; created_at?: string }>;
  purchases?: Array<{ user_id?: string; credits?: number; amount_usd?: number; status?: string; created_at?: string }>;
};

function number(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function credits(value: unknown) {
  return number(value).toLocaleString();
}

function money(value: unknown) {
  return `$${number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function shortUser(value: string) {
  return value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="stat"><span>{label}</span><strong>{value}</strong><p>{detail}</p></article>;
}

export default function UsageCreditsAdminClient() {
  const [state, setState] = useState<AdminUsageState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/usage-credits", { cache: "no-store", credentials: "same-origin" });
      const payload = await response.json().catch(() => ({})) as AdminUsageState;
      if (!response.ok || payload.ok === false) throw new Error(payload.error || "Could not load usage and credits.");
      setState(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load usage and credits.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return state?.users || [];
    return (state?.users || []).filter((user) => `${user.userId} ${user.planId} ${user.status}`.toLowerCase().includes(value));
  }, [query, state?.users]);

  const totals = state?.totals || {};

  return <main className="shell">
    <header className="hero">
      <div><p>ADMIN CONTROL CENTER</p><h1>Usage & Credits</h1><span>Daily limits, paid balances, revenue, spend exposure, and highest-cost accounts.</span></div>
      <button type="button" onClick={() => void load()} disabled={loading}>{loading ? "Refreshing…" : "Refresh data"}</button>
    </header>

    {error ? <div className="error">{error}</div> : null}

    <section className="stats">
      <Stat label="Accounts" value={credits(totals.users)} detail={`${credits(totals.activeUsersToday)} active today`} />
      <Stat label="Credits used today" value={credits(totals.dailyCreditsUsed)} detail="Across all active accounts" />
      <Stat label="Outstanding credits" value={credits(number(totals.includedCreditsAvailable) + number(totals.paidCreditsAvailable))} detail={`${credits(totals.paidCreditsAvailable)} purchased credits`} />
      <Stat label="Tracked monthly spend" value={money(totals.monthlySpendUsd)} detail="Current account spend exposure" />
      <Stat label="Credit-pack revenue" value={money(totals.purchaseRevenueUsd)} detail="Successful purchases in returned history" />
    </section>

    <section className="panel">
      <div className="panelHead"><div><p>ACCOUNT RISK</p><h2>Highest daily usage</h2></div><input value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Search user, plan, or status" /></div>
      <div className="tableWrap"><table><thead><tr><th>User</th><th>Plan</th><th>Daily</th><th>Remaining</th><th>Included</th><th>Purchased</th><th>Spend</th><th>Status</th></tr></thead><tbody>{filtered.map((user) => <tr key={user.userId}><td title={user.userId}>{shortUser(user.userId)}</td><td>{user.planId}</td><td>{credits(user.dailyUsed)} / {credits(user.dailyLimit)}</td><td>{credits(user.dailyAvailable)}</td><td>{credits(user.includedAvailable)}</td><td>{credits(user.paidAvailable)}</td><td>{money(user.monthlySpendUsd)}</td><td>{user.status}</td></tr>)}</tbody></table></div>
    </section>

    <section className="grid">
      <article className="panel"><div className="panelHead"><div><p>COST CONTROL</p><h2>Highest spend</h2></div></div><div className="rows">{(state?.highestSpend || []).slice(0, 12).map((user) => <div key={user.userId}><b>{shortUser(user.userId)}</b><span>{user.planId}</span><strong>{money(user.monthlySpendUsd)}</strong></div>)}</div></article>
      <article className="panel"><div className="panelHead"><div><p>RECENT PURCHASES</p><h2>Extra credit sales</h2></div></div><div className="rows">{(state?.purchases || []).slice(0, 12).map((item, index) => <div key={`${item.user_id}-${item.created_at}-${index}`}><b>{shortUser(String(item.user_id || "unknown"))}</b><span>{credits(item.credits)} credits · {item.status || "unknown"}</span><strong>{money(item.amount_usd)}</strong></div>)}</div></article>
    </section>

    <section className="panel"><div className="panelHead"><div><p>LEDGER</p><h2>Latest credit movements</h2></div><span>Generated {state?.generatedAt ? new Date(state.generatedAt).toLocaleString() : "pending"}</span></div><div className="ledger">{(state?.ledger || []).slice(0, 30).map((item, index) => <div key={`${item.user_id}-${item.created_at}-${index}`}><b>{item.reason || item.ledger_type || "Usage activity"}</b><span>{shortUser(String(item.user_id || "unknown"))} · {item.feature_key || "account"} {item.stage ? `· ${item.stage}` : ""}</span><strong>{credits(item.amount)} credits</strong><time>{item.created_at ? new Date(item.created_at).toLocaleString() : ""}</time></div>)}</div></section>

    <style jsx>{`
      .shell{min-height:100vh;padding:28px;background:#020617;color:#e5eefb;font-family:Inter,ui-sans-serif,system-ui}.hero{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;margin-bottom:22px}.hero p,.panelHead p{margin:0 0 6px;color:#38bdf8;font-size:11px;font-weight:900;letter-spacing:.16em}.hero h1{margin:0;font-size:34px}.hero span,.panelHead span{display:block;margin-top:8px;color:#94a3b8;font-size:13px}.hero button,.panelHead input{border:1px solid rgba(56,189,248,.35);border-radius:10px;background:#0f172a;color:#e5eefb;padding:10px 14px}.error{margin-bottom:18px;padding:12px;border:1px solid rgba(248,113,113,.4);background:rgba(127,29,29,.25);color:#fecaca}.stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin-bottom:16px}.stat,.panel{border:1px solid rgba(148,163,184,.17);border-radius:16px;background:#07101f;box-shadow:0 18px 45px rgba(0,0,0,.2)}.stat{padding:16px}.stat span{color:#94a3b8;font-size:11px;text-transform:uppercase}.stat strong{display:block;margin-top:8px;font-size:24px}.stat p{margin:7px 0 0;color:#64748b;font-size:11px}.panel{padding:16px;margin-bottom:16px}.panelHead{display:flex;justify-content:space-between;gap:16px;align-items:center;margin-bottom:14px}.panelHead h2{margin:0;font-size:18px}.panelHead input{min-width:280px}.tableWrap{overflow:auto}table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:10px 8px;border-bottom:1px solid rgba(148,163,184,.12);text-align:left;white-space:nowrap}th{color:#7dd3fc;font-size:10px;text-transform:uppercase}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.rows,.ledger{display:grid;gap:8px}.rows>div,.ledger>div{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:12px;align-items:center;padding:10px;border-radius:10px;background:#0b1526}.rows span,.ledger span,.ledger time{color:#94a3b8;font-size:11px}.ledger>div{grid-template-columns:minmax(200px,1fr) minmax(220px,1fr) auto auto}.ledger strong{color:#a7f3d0}@media(max-width:1100px){.stats{grid-template-columns:repeat(2,minmax(0,1fr))}.grid{grid-template-columns:1fr}}@media(max-width:700px){.shell{padding:16px}.hero,.panelHead{flex-direction:column}.stats{grid-template-columns:1fr}.panelHead input{min-width:0;width:100%}.ledger>div{grid-template-columns:1fr}.rows>div{grid-template-columns:1fr auto}}
    `}</style>
  </main>;
}
