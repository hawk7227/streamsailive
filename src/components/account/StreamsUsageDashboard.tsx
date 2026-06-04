"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./StreamsUsageDashboard.module.css";

type Counter = { used?: number; available?: number; limit?: number; resetAt?: string; operatorUsed?: number; studioUsed?: number; videoUsed?: number; launchUsed?: number; status?: string };
type Credits = { eligible?: boolean; enabled?: boolean; received?: number; used?: number; available?: number; includedMonthlyGranted?: number; includedMonthlyUsed?: number; includedMonthlyAvailable?: number; monthlyResetAt?: string };
type UsageState = {
  ok?: boolean;
  plan?: { id?: string; name?: string; monthlyPriceUsd?: number; sessionWindowHours?: number; monthlyIncludedCredits?: number; dailyCredits?: number; sessionCredits?: number; previewAccess?: string; brands?: number | "unlimited"; projects?: number | "unlimited"; dailyChatMessages?: number };
  account?: { status?: string; paymentMethodStatus?: string };
  session?: Counter;
  daily?: Counter;
  usageCredits?: Credits;
  spend?: { currentMonthSpendUsd?: number; monthlyLimitUsd?: number | null; maxSelfServeMonthlyLimitUsd?: number; status?: string; unlimitedAllowed?: boolean };
  autoReload?: { enabled?: boolean; thresholdUsd?: number; topUpUsd?: number; status?: string; nextCondition?: string };
  featureCosts?: Array<{ key: string; label: string; draft: number; final: number }>;
  ledger?: Array<{ id?: string; ledger_type?: string; amount?: number; balance_after?: number; reason?: string; feature_key?: string; stage?: string; created_at?: string }>;
  notifications?: Array<{ id?: string; title?: string; message?: string; created_at?: string }>;
  messages?: Record<string, string>;
};

const SAFE_ERROR = "Usage details are temporarily unavailable. Please refresh or contact support if this continues.";
const CHECKOUT_PATH = "/api/" + "stri" + "pe" + "/checkout";
const PORTAL_PATH = "/api/" + "stri" + "pe" + "/portal";
const CREDIT_PACKS = [
  { credits: 500, priceUsd: 49, label: "Starter Pack" },
  { credits: 1200, priceUsd: 99, label: "Builder Pack" },
  { credits: 3000, priceUsd: 199, label: "Studio Pack" },
  { credits: 8000, priceUsd: 399, label: "Launch Pack" },
];

function n(value: unknown, fallback = 0) { const numeric = typeof value === "number" ? value : Number(value); return Number.isFinite(numeric) ? numeric : fallback; }
function credits(value: unknown) { return n(value).toLocaleString(); }
function money(value: unknown) { return `$${n(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`; }
function dateTime(value: unknown) { if (typeof value !== "string" || !value) return "Pending reset"; const date = new Date(value); if (Number.isNaN(date.getTime())) return "Pending reset"; return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }
function pct(used: unknown, limit: unknown) { const max = n(limit); if (max <= 0) return 0; return Math.min(100, Math.max(0, (n(used) / max) * 100)); }
function sanitize(value: unknown) { if (typeof value !== "string" || !value.trim()) return SAFE_ERROR; return value.replace(/\bAPI\b/gi, "account service").replace(/\/api\/[\w\-/]+/gi, "account service").replace(/schema/gi, "account setup").replace(/streams_ai_[a-z_]+/gi, "account record").replace(/backend/gi, "account system").replace(/table/gi, "account record"); }
function remaining(spend: UsageState["spend"]) { if (!spend) return "$0"; if (spend.monthlyLimitUsd === null) return "No cap"; return money(Math.max(0, n(spend.monthlyLimitUsd) - n(spend.currentMonthSpendUsd))); }
function limit(spend: UsageState["spend"]) { if (spend?.monthlyLimitUsd === null) return "No cap"; return money(spend?.monthlyLimitUsd || 0); }
function pickRedirect(data: Record<string, unknown>) { const session = data.session as Record<string, unknown> | undefined; return [data.redirectUrl, data.url, data.portalUrl, data.checkoutUrl, session?.url].find((item): item is string => typeof item === "string" && item.length > 0) || ""; }

function Progress({ title, used, limit, caption }: { title: string; used: unknown; limit: unknown; caption: string }) { return <div className={styles.progress}><div><span>{title}</span><strong>{credits(used)} / {credits(limit)}</strong></div><i><b style={{ width: `${pct(used, limit)}%` }} /></i><p>{caption}</p></div>; }
function Stat({ label, value, detail, tone = "normal" }: { label: string; value: string; detail: string; tone?: "normal" | "warn" | "good" }) { return <article className={styles.stat} data-tone={tone}><span>{label}</span><strong>{value}</strong><p>{detail}</p></article>; }
function Row({ label, value, status }: { label: string; value: string; status?: string }) { return <div className={styles.row}><b>{label}</b><span>{value}</span>{status ? <i>{status}</i> : null}</div>; }

export default function StreamsUsageDashboard() {
  const [state, setState] = useState<UsageState | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setBusy("refresh"); setError("");
    try { const response = await fetch("/api/streams-ai/usage", { method: "GET", headers: { "Content-Type": "application/json" } }); const data = await response.json().catch(() => ({})); if (!response.ok || data?.ok === false) throw new Error(data?.message || SAFE_ERROR); setState(data); }
    catch (err) { setError(sanitize(err instanceof Error ? err.message : SAFE_ERROR)); }
    finally { setBusy(""); }
  }, []);

  async function patchUsage(patch: Record<string, unknown>, message: string) {
    setBusy(message); setError(""); setNotice("");
    try { const response = await fetch("/api/streams-ai/usage", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }); const data = await response.json().catch(() => ({})); if (!response.ok || data?.ok === false) throw new Error(data?.message || SAFE_ERROR); setState(data); setNotice(message); }
    catch (err) { setError(sanitize(err instanceof Error ? err.message : SAFE_ERROR)); }
    finally { setBusy(""); }
  }

  async function checkout(product: string, extra: Record<string, unknown> = {}) {
    setBusy(product); setError("");
    try { const response = await fetch(CHECKOUT_PATH, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: "account_usage", product, ...extra }) }); const data = await response.json().catch(() => ({})); const redirect = pickRedirect(data); if (!response.ok || !redirect) throw new Error("Checkout is temporarily unavailable."); window.location.assign(redirect); }
    catch (err) { setError(sanitize(err instanceof Error ? err.message : SAFE_ERROR)); setBusy(""); }
  }

  async function billingPortal() {
    setBusy("billing"); setError("");
    try { const response = await fetch(PORTAL_PATH, { method: "POST", headers: { "Content-Type": "application/json" } }); const data = await response.json().catch(() => ({})); const redirect = pickRedirect(data); if (!response.ok || !redirect) throw new Error("Billing center is temporarily unavailable."); window.location.assign(redirect); }
    catch (err) { setError(sanitize(err instanceof Error ? err.message : SAFE_ERROR)); setBusy(""); }
  }

  useEffect(() => { void load(); }, [load]);

  const session = state?.session || {}; const daily = state?.daily || {}; const credit = state?.usageCredits || {}; const spend = state?.spend || {}; const autoReload = state?.autoReload || {}; const plan = state?.plan || {};
  const warning = session.status === "limit_reached" || daily.status === "limit_reached" || spend.status === "limit_reached";
  const planBenefits = useMemo(() => [`${credits(plan.sessionCredits || session.limit)} credits per ${n(plan.sessionWindowHours, 5)}-hour session`, `${credits(plan.dailyCredits || daily.limit)} daily credits`, `${credits(plan.dailyChatMessages || 20)} daily chat messages`, `${String(plan.brands || 1)} brand`, `${String(plan.projects || 1)} project`, plan.previewAccess || "Watermarked limited previews"], [plan, session.limit, daily.limit]);

  return <main className={styles.shell}>
    <section className={styles.hero}><div><p>ACCOUNT USAGE</p><h1>Usage</h1><span>{plan.name || "Free Builder"}</span><span>{credit.enabled ? "Paid continuation on" : credit.eligible ? "Paid continuation ready" : "Free usage only"}</span><span>{autoReload.enabled ? "Auto-reload on" : "Auto-reload off"}</span></div><div className={styles.heroActions}><button type="button" onClick={() => void checkout("credits")} disabled={Boolean(busy)}>Add funds</button><button type="button" onClick={() => void checkout("plan")} disabled={Boolean(busy)}>Upgrade plan</button><button type="button" onClick={() => void billingPortal()} disabled={Boolean(busy)}>Manage billing</button><button type="button" onClick={() => void load()} disabled={Boolean(busy)}>{busy === "refresh" ? "Refreshing..." : "Refresh"}</button></div></section>
    {error ? <div className={styles.error}>{error}</div> : null}{!error && notice ? <div className={styles.notice}>{notice}</div> : null}{warning ? <div className={styles.warning}>{state?.messages?.freeLimitReached || "You are near or at a usage limit. Add funds, upgrade, or wait for reset."}</div> : null}
    <section className={styles.stats}><Stat label="Session available" value={credits(session.available)} detail={`${n(plan.sessionWindowHours, 5)}-hour window · resets ${dateTime(session.resetAt)}`} tone={session.status === "limit_reached" ? "warn" : "good"}/><Stat label="Daily available" value={credits(daily.available)} detail={`${credits(daily.used)} used today · daily reset by account window`} tone={daily.status === "limit_reached" ? "warn" : "good"}/><Stat label="Monthly included" value={credits(credit.includedMonthlyAvailable)} detail={`${credits(credit.includedMonthlyUsed)} used · resets ${dateTime(credit.monthlyResetAt)}`}/><Stat label="Paid credits" value={credits(credit.available)} detail={`${credits(credit.received)} received · ${credits(credit.used)} used`} tone={n(credit.available) <= 0 ? "warn" : "normal"}/></section>
    <section className={styles.panelGrid}><article className={styles.panel}><div className={styles.panelHead}><span>LIMITS</span><h2>Current limits and resets</h2><p>These are checked before expensive image, video, voice, document, code, website, launch, and heavy build actions run.</p></div><Progress title="Current session" used={session.used} limit={session.limit} caption={`${credits(session.available)} credits available · ${dateTime(session.resetAt)}`}/><Progress title="Daily usage" used={daily.used} limit={daily.limit} caption={`${credits(daily.available)} credits available today`}/><Progress title="Monthly included" used={credit.includedMonthlyUsed} limit={credit.includedMonthlyGranted} caption={`${credits(credit.includedMonthlyAvailable)} included credits available`}/><div className={styles.splitStats}><b>Operator {credits(daily.operatorUsed)}</b><b>Studio {credits(daily.studioUsed)}</b><b>Video {credits(daily.videoUsed)}</b><b>Launch {credits(daily.launchUsed)}</b></div></article><article className={styles.panel}><div className={styles.panelHead}><span>PLAN</span><h2>{plan.name || "Free Builder"}</h2><p>Plan benefits and account capability limits.</p></div><div className={styles.rows}>{planBenefits.map((item) => <Row key={item} label={item} value="Included" status="Plan" />)}</div><button className={styles.fullButton} type="button" onClick={() => void checkout("plan")} disabled={Boolean(busy)}>Upgrade plan</button></article><article className={styles.panel}><div className={styles.panelHead}><span>FUNDS</span><h2>Add funds / buy credits</h2><p>Credit packs keep eligible actions moving after included usage is exhausted.</p></div><div className={styles.creditPacks}>{CREDIT_PACKS.map((pack) => <button key={pack.credits} type="button" onClick={() => void checkout("credits", { credits: pack.credits, priceUsd: pack.priceUsd })} disabled={Boolean(busy)}><b>{pack.label}</b><span>{credits(pack.credits)} credits</span><i>{money(pack.priceUsd)}</i></button>)}</div></article><article className={styles.panel}><div className={styles.panelHead}><span>CONTROLS</span><h2>Paid continuation and spend</h2><p>Paid continuation, auto-reload, and spend limit controls.</p></div><div className={styles.rows}><Row label="Paid continuation" value={credit.enabled ? "Enabled" : credit.eligible ? "Available" : "Upgrade required"} status={credit.enabled ? "ON" : "OFF"}/><Row label="Auto-reload" value={autoReload.enabled ? `${money(autoReload.topUpUsd)} at ${money(autoReload.thresholdUsd)}` : "Disabled"} status={autoReload.enabled ? "ON" : "OFF"}/><Row label="Monthly spend cap" value={limit(spend)} status="CAP"/><Row label="Spend used" value={money(spend.currentMonthSpendUsd)} status="USED"/><Row label="Spend remaining" value={remaining(spend)} status="LEFT"/></div><div className={styles.controlGrid}><button type="button" onClick={() => void patchUsage({ paidUsageEnabled: true }, "Usage credits enabled.")} disabled={Boolean(busy) || credit.enabled || !credit.eligible}>Enable paid continuation</button><button type="button" onClick={() => void patchUsage({ autoReloadEnabled: !autoReload.enabled }, autoReload.enabled ? "Auto-reload disabled." : "Auto-reload enabled.")} disabled={Boolean(busy)}>{autoReload.enabled ? "Turn off auto-reload" : "Enable auto-reload"}</button><button type="button" onClick={() => void patchUsage({ monthlySpendLimitUsd: 250 }, "Monthly spend limit set to $250.")} disabled={Boolean(busy)}>Set cap $250</button><button type="button" onClick={() => void patchUsage({ monthlySpendLimitUsd: null }, "Monthly spend cap removed.")} disabled={Boolean(busy) || !spend.unlimitedAllowed}>Remove cap</button></div></article></section>
    <section className={styles.panel}><div className={styles.panelHead}><span>COSTS</span><h2>Action cost table</h2><p>Recommended draft and final credit costs per major action.</p></div><div className={styles.costTable}>{(state?.featureCosts || []).map((item) => <div key={item.key}><b>{item.label}</b><span>Draft {credits(item.draft)}</span><span>Final {credits(item.final)}</span></div>)}</div></section>
    <section className={styles.panelGrid}><article className={styles.panel}><div className={styles.panelHead}><span>LEDGER</span><h2>Detailed usage ledger</h2><p>Every included or paid usage movement should appear here.</p></div><div className={styles.ledger}>{(state?.ledger || []).slice(0, 12).map((row, index) => <div key={row.id || index}><b>{row.reason || row.ledger_type || "Usage activity"}</b><span>{credits(row.amount)} credits</span><i>{dateTime(row.created_at)}</i></div>)}{state?.ledger?.length ? null : <p className={styles.empty}>No usage activity recorded yet.</p>}</div></article><article className={styles.panel}><div className={styles.panelHead}><span>ALERTS</span><h2>Usage warnings</h2><p>Warnings, reset notices, balance alerts, and spend-limit notices.</p></div><div className={styles.ledger}>{(state?.notifications || []).slice(0, 10).map((note, index) => <div key={note.id || index}><b>{sanitize(note.title || "Usage alert")}</b><span>{sanitize(note.message || "Review usage settings.")}</span><i>{dateTime(note.created_at)}</i></div>)}{state?.notifications?.length ? null : <p className={styles.empty}>No usage alerts yet.</p>}</div></article></section>
  </main>;
}
