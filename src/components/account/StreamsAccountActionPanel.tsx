"use client";

import { useEffect, useState } from "react";
import styles from "./StreamsAccountActionPanel.module.css";

type PageKind =
  | "overview"
  | "profile"
  | "settings"
  | "privacy"
  | "billing"
  | "credits"
  | "usage"
  | "modules"
  | "notifications"
  | "personalization"
  | "language"
  | "apps"
  | "storage"
  | "security"
  | "keyboard"
  | "gift"
  | "help"
  | "learnMore";

type Props = {
  pageKind: PageKind;
  title: string;
  description: string;
};

type UsageCounter = {
  used?: number;
  available?: number;
  limit?: number;
  resetAt?: string;
  status?: string;
  operatorUsed?: number;
  studioUsed?: number;
  videoUsed?: number;
  launchUsed?: number;
};

type UsageCredits = {
  eligible?: boolean;
  enabled?: boolean;
  received?: number;
  used?: number;
  available?: number;
  includedMonthlyGranted?: number;
  includedMonthlyUsed?: number;
  includedMonthlyAvailable?: number;
  monthlyResetAt?: string;
};

type LedgerRow = {
  id?: string;
  ledger_type?: string;
  amount?: number;
  balance_after?: number;
  feature_key?: string;
  stage?: string;
  reason?: string;
  created_at?: string;
};

type UsageNotification = {
  id?: string;
  title?: string;
  message?: string;
  event_type?: string;
  created_at?: string;
  action_href?: string;
};

type UsageState = {
  ok?: boolean;
  plan?: { name?: string; monthlyPriceUsd?: number; dailyChatMessages?: number; previewAccess?: string };
  account?: { status?: string; paymentMethodStatus?: string };
  session?: UsageCounter;
  daily?: UsageCounter;
  usageCredits?: UsageCredits;
  spend?: { currentMonthSpendUsd?: number; monthlyLimitUsd?: number | null; status?: string; unlimitedAllowed?: boolean };
  autoReload?: { enabled?: boolean; thresholdUsd?: number; topUpUsd?: number; status?: string; nextCondition?: string };
  featureCosts?: Array<{ key: string; label: string; draft: number; final: number }>;
  ledger?: LedgerRow[];
  notifications?: UsageNotification[];
  messages?: Record<string, string>;
};

type PageConfig = {
  eyebrow: string;
  gradient: string;
  badge: string;
  narrative: string;
};

const SAFE_SETUP_MESSAGE =
  "This account control is not fully set up yet. Your current work is safe, but this action cannot run until account usage is connected.";

const CONFIG: Record<PageKind, PageConfig> = {
  overview: { eyebrow: "Workspace command center", gradient: "blue", badge: "Account ready", narrative: "Manage plan access, usage, credits, billing controls, and account readiness in one compact Streams view." },
  profile: { eyebrow: "Identity", gradient: "violet", badge: "Account", narrative: "Review account status, workspace access, and plan-linked limits without exposing internal system details." },
  settings: { eyebrow: "Controls", gradient: "slate", badge: "Setup ready", narrative: "Workspace controls are organized and ready for deeper persistence without showing technical setup text." },
  privacy: { eyebrow: "Trust layer", gradient: "green", badge: "Privacy", narrative: "Data controls, privacy settings, and export/delete readiness with polished setup-required states." },
  billing: { eyebrow: "Plan and billing", gradient: "gold", badge: "Billing", narrative: "Manage plan access, account billing, usage credits, spend controls, and recent usage activity." },
  credits: { eyebrow: "Usage credits", gradient: "cyan", badge: "Credits", narrative: "Track credits received, credits used, credits available, low-balance alerts, and credit-pack options." },
  usage: { eyebrow: "Account usage", gradient: "cyan", badge: "Usage live", narrative: "See included usage, daily limits, paid usage credits, spend limits, auto-reload, and feature credit costs." },
  modules: { eyebrow: "Capabilities", gradient: "pink", badge: "Capabilities", narrative: "Review the Streams capability surface and the credit costs tied to premium actions." },
  notifications: { eyebrow: "Alerts", gradient: "blue", badge: "Notifications", narrative: "Usage, spend, balance, reset, and account-control alerts appear here with clear next steps." },
  personalization: { eyebrow: "Assistant style", gradient: "violet", badge: "Personalization", narrative: "Personalization controls are staged in the account system with safe setup-ready states." },
  language: { eyebrow: "Region", gradient: "blue", badge: "Locale", narrative: "Language, timezone, and formatting controls are organized for account-level persistence." },
  apps: { eyebrow: "Connected systems", gradient: "green", badge: "Connectors", narrative: "Connectors and app connections stay user-facing and setup-ready until each connection is live." },
  storage: { eyebrow: "Storage", gradient: "slate", badge: "Storage", narrative: "Manage account storage readiness, saved work, exports, and retained project assets." },
  security: { eyebrow: "Security", gradient: "green", badge: "Security", narrative: "Review login, session, workspace access, and security readiness without raw backend labels." },
  keyboard: { eyebrow: "Keyboard", gradient: "slate", badge: "Shortcuts", narrative: "Keyboard shortcuts and productivity controls are kept clean and ready for account persistence." },
  gift: { eyebrow: "Growth loop", gradient: "gold", badge: "Invites", narrative: "Invite and gift-credit flows remain setup-ready until real account credit handling is connected." },
  help: { eyebrow: "Support", gradient: "slate", badge: "Help", narrative: "Find account support, usage guidance, and safe setup-required states for unavailable controls." },
  learnMore: { eyebrow: "Product education", gradient: "cyan", badge: "Learn", narrative: "Learn how Streams usage, feature costs, billing controls, and plan limits work together." },
};

function numberValue(value: unknown, fallback = 0) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function formatCredits(value: unknown) {
  return numberValue(value).toLocaleString();
}

function formatMoney(value: unknown) {
  return `$${numberValue(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatDateTime(value: unknown) {
  if (typeof value !== "string" || !value) return "Not scheduled";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not scheduled";
  return parsed.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function progressPercent(used: unknown, limit: unknown) {
  const max = numberValue(limit);
  if (max <= 0) return 0;
  return Math.min(100, Math.max(0, (numberValue(used) / max) * 100));
}

function sanitizeMessage(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return SAFE_SETUP_MESSAGE;
  return value
    .replace(/\bStripe\b/gi, "billing")
    .replace(/\bOpenAI\b/gi, "AI")
    .replace(/\bAPI\b/g, "account control")
    .replace(/schema cache/gi, "account setup")
    .replace(/table missing/gi, "account setup missing")
    .replace(/\/api\/[\w\-/]+/gi, "account service")
    .replace(/streams_ai_[a-z_]+/gi, "account record")
    .replace(/provider/gi, "service")
    .replace(/backend/gi, "account system");
}

function ledgerTitle(row: LedgerRow) {
  const amount = numberValue(row.amount);
  if ((row.ledger_type || "").includes("paid")) return amount < 0 ? "Usage credits applied" : "Usage credits added";
  if ((row.ledger_type || "").includes("reset")) return "Included usage reset";
  if ((row.ledger_type || "").includes("grant")) return "Included usage granted";
  return amount < 0 ? "Usage recorded" : "Credit activity";
}

async function readJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function pickRedirect(data: Record<string, unknown>) {
  const session = data.session as Record<string, unknown> | undefined;
  const candidates = [data.redirectUrl, data.url, data.portalUrl, data.checkoutUrl, session?.url];
  return candidates.find((item): item is string => typeof item === "string" && item.length > 0) || "";
}

function ProgressLine({ label, used, limit, helper }: { label: string; used: unknown; limit: unknown; helper?: string }) {
  return (
    <div className={styles.progressLine}>
      <div className={styles.progressTop}>
        <span>{label}</span>
        <strong>{formatCredits(used)} / {formatCredits(limit)}</strong>
      </div>
      <div className={styles.progressTrack} aria-hidden="true">
        <i style={{ width: `${progressPercent(used, limit)}%` }} />
      </div>
      {helper ? <p>{helper}</p> : null}
    </div>
  );
}

export default function StreamsAccountActionPanel({ pageKind, title, description }: Props) {
  const config = CONFIG[pageKind] || CONFIG.overview;
  const [usage, setUsage] = useState<UsageState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function loadUsage() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/streams-ai/usage", { method: "GET", headers: { "Content-Type": "application/json" } });
      const data = (await readJson(response)) as UsageState & { message?: string; error?: string };
      if (!response.ok || data.ok === false) throw new Error(data.message || data.error || SAFE_SETUP_MESSAGE);
      setUsage(data);
      setNotice("Account usage loaded.");
    } catch (err) {
      setError(sanitizeMessage(err instanceof Error ? err.message : SAFE_SETUP_MESSAGE));
    } finally {
      setLoading(false);
    }
  }

  async function updateUsageSettings(patch: Record<string, unknown>, success: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/streams-ai/usage", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await readJson(response)) as UsageState & { message?: string; error?: string };
      if (!response.ok || data.ok === false) throw new Error(data.message || data.error || SAFE_SETUP_MESSAGE);
      setUsage(data);
      setNotice(success);
    } catch (err) {
      setError(sanitizeMessage(err instanceof Error ? err.message : SAFE_SETUP_MESSAGE));
    } finally {
      setBusy(false);
    }
  }

  async function openAccountBilling() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/stripe/portal", { method: "POST", headers: { "Content-Type": "application/json" } });
      const data = (await readJson(response)) as Record<string, unknown>;
      const redirect = pickRedirect(data);
      if (!response.ok || !redirect) throw new Error("Billing setup is not ready yet.");
      window.location.assign(redirect);
    } catch (err) {
      setError(sanitizeMessage(err instanceof Error ? err.message : SAFE_SETUP_MESSAGE));
    } finally {
      setBusy(false);
    }
  }

  async function startPlanSetup(product = "plan") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: pageKind, product }),
      });
      const data = (await readJson(response)) as Record<string, unknown>;
      const redirect = pickRedirect(data);
      if (!response.ok || !redirect) throw new Error("Billing setup is not ready yet.");
      window.location.assign(redirect);
    } catch (err) {
      setError(sanitizeMessage(err instanceof Error ? err.message : SAFE_SETUP_MESSAGE));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void loadUsage();
  }, []);

  const session = usage?.session || {};
  const daily = usage?.daily || {};
  const credits = usage?.usageCredits || {};
  const spend = usage?.spend || {};
  const autoReload = usage?.autoReload || {};
  const planName = usage?.plan?.name || "Free Builder";
  const monthlyLimitLabel = spend.monthlyLimitUsd === null ? "Unlimited" : formatMoney(spend.monthlyLimitUsd ?? 0);

  const heroActions = [
    ...(pageKind === "billing" ? [
      { label: "Open billing portal", action: openAccountBilling, disabled: false },
      { label: "Set up plan", action: () => startPlanSetup("plan"), disabled: false },
    ] : []),
    ...((pageKind === "credits" || pageKind === "usage") ? [
      { label: "Add usage credits", action: () => startPlanSetup("credits"), disabled: false },
      { label: credits.enabled ? "Usage credits on" : "Turn on usage credits", action: () => updateUsageSettings({ paidUsageEnabled: true }, "Usage credits turned on."), disabled: Boolean(credits.enabled) },
      { label: autoReload.enabled ? "Auto-reload on" : "Enable auto-reload", action: () => updateUsageSettings({ autoReloadEnabled: true }, "Auto-reload enabled."), disabled: Boolean(autoReload.enabled) },
    ] : []),
    { label: "Refresh usage", action: loadUsage, disabled: false },
  ];

  const setupRows = [
    { label: "Current plan", value: planName, status: "live" },
    { label: "Included reset", value: formatDateTime(session.resetAt), status: "live" },
    { label: "Usage credits", value: credits.enabled ? "On" : credits.eligible ? "Available" : "Upgrade required", status: credits.enabled ? "live" : "setup" },
    { label: "Account status", value: usage?.account?.status || "Active", status: "live" },
  ];

  return (
    <main className={styles.shell} data-gradient={config.gradient}>
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <p className={styles.kicker}>{config.eyebrow}</p>
          <h1>{title}</h1>
          <p>{description || config.narrative}</p>
          <div className={styles.heroMeta}>
            <span>{config.badge}</span>
            <span>{planName}</span>
            <span>{loading ? "Loading" : "Usage ready"}</span>
          </div>
        </div>
        <div className={styles.heroActions}>
          {heroActions.map((item) => (
            <button key={item.label} type="button" onClick={item.action} disabled={busy || item.disabled}>
              {busy ? "Working..." : item.label}
            </button>
          ))}
        </div>
      </section>

      {error ? <section className={styles.error}>{error}</section> : null}
      {!error && notice ? <section className={styles.notice}>{notice}</section> : null}

      <section className={styles.grid}>
        <article className={styles.card}>
          <span>Current plan</span>
          <strong>{planName}</strong>
          <h3>{formatMoney(usage?.plan?.monthlyPriceUsd || 0)} / month</h3>
          <p>{usage?.plan?.previewAccess || "Account access is being prepared."}</p>
        </article>
        <article className={styles.card}>
          <span>Included usage</span>
          <strong>{formatCredits(session.available)}</strong>
          <h3>Session credits available</h3>
          <p>Resets {formatDateTime(session.resetAt)}.</p>
        </article>
        <article className={styles.card}>
          <span>Usage credits</span>
          <strong>{formatCredits(credits.available)}</strong>
          <h3>{credits.enabled ? "Paid usage credits on" : "Paid usage credits off"}</h3>
          <p>{credits.eligible ? "Paid plans can continue with usage credits after included usage is exhausted." : "Free plans can wait for reset or upgrade."}</p>
        </article>
        <article className={styles.card}>
          <span>Spend limit</span>
          <strong>{monthlyLimitLabel}</strong>
          <h3>{formatMoney(spend.currentMonthSpendUsd || 0)} used this month</h3>
          <p>{spend.status === "limit_reached" ? "Monthly spend limit reached." : "Spend controls are active."}</p>
        </article>
      </section>

      <section className={styles.panelGrid}>
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <span>Plan usage limits</span>
            <h2>Included session usage</h2>
            <p>{usage?.messages?.approachingIncludedLimit || "Session usage resets automatically in the current window."}</p>
          </div>
          <ProgressLine label="Current session" used={session.used} limit={session.limit} helper={`${formatCredits(session.available)} available · resets ${formatDateTime(session.resetAt)}`} />
          <ProgressLine label="Monthly included" used={credits.includedMonthlyUsed} limit={credits.includedMonthlyGranted} helper={`${formatCredits(credits.includedMonthlyAvailable)} included credits available`} />
        </article>
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <span>Daily limits</span>
            <h2>Today’s usage</h2>
            <p>Operator, studio, video, and launch usage share your daily plan allowance.</p>
          </div>
          <ProgressLine label="Daily usage" used={daily.used} limit={daily.limit} helper={`${formatCredits(daily.available)} credits available today`} />
          <div className={styles.compactStats}>
            <b>Operator {formatCredits(daily.operatorUsed)}</b>
            <b>Studio {formatCredits(daily.studioUsed)}</b>
            <b>Video {formatCredits(daily.videoUsed)}</b>
            <b>Launch {formatCredits(daily.launchUsed)}</b>
          </div>
        </article>
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <span>Usage credits</span>
            <h2>Paid credit balance</h2>
            <p>{usage?.messages?.lowBalance || "Add credits or turn on auto-reload to keep building without interruption."}</p>
          </div>
          <div className={styles.rows}>
            <div className={styles.row} data-status="live"><b>Credits received</b><span>{formatCredits(credits.received)}</span><i>Live</i></div>
            <div className={styles.row} data-status="live"><b>Credits used</b><span>{formatCredits(credits.used)}</span><i>Live</i></div>
            <div className={styles.row} data-status="live"><b>Credits available</b><span>{formatCredits(credits.available)}</span><i>Live</i></div>
            <div className={styles.row} data-status={credits.enabled ? "live" : "setup"}><b>Paid usage credits</b><span>{credits.enabled ? "Enabled" : credits.eligible ? "Ready to enable" : "Upgrade required"}</span><i>{credits.enabled ? "On" : "Setup"}</i></div>
          </div>
        </article>
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <span>Auto-reload</span>
            <h2>{autoReload.enabled ? "Auto-reload enabled" : "Auto-reload off"}</h2>
            <p>{usage?.messages?.autoReloadSetup || "You control the threshold, top-up amount, and monthly spend limit."}</p>
          </div>
          <div className={styles.rows}>
            <div className={styles.row} data-status={autoReload.enabled ? "live" : "off"}><b>Status</b><span>{autoReload.enabled ? "Enabled" : "Disabled"}</span><i>{autoReload.enabled ? "On" : "Off"}</i></div>
            <div className={styles.row} data-status="setup"><b>Reload threshold</b><span>{formatMoney(autoReload.thresholdUsd || 0)}</span><i>Set</i></div>
            <div className={styles.row} data-status="setup"><b>Reload amount</b><span>{formatMoney(autoReload.topUpUsd || 0)}</span><i>Set</i></div>
            <div className={styles.row} data-status="setup"><b>Next condition</b><span>{autoReload.nextCondition || "Balance, payment, and spend limit must allow it."}</span><i>Rule</i></div>
          </div>
        </article>
      </section>

      {(pageKind === "usage" || pageKind === "credits" || pageKind === "billing" || pageKind === "modules") ? (
        <section className={styles.sectionVisible}>
          <div className={styles.panelHead}>
            <span>Feature usage costs</span>
            <h2>Premium action cost guide</h2>
            <p>Draft actions use fewer credits. Final generation, launch, video, and code actions use more credits before execution.</p>
          </div>
          <div className={styles.costTable}>
            {(usage?.featureCosts || []).map((item) => (
              <div key={item.key}>
                <b>{item.label}</b>
                <span>Draft {formatCredits(item.draft)}</span>
                <span>Final {formatCredits(item.final)}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {(pageKind === "usage" || pageKind === "billing" || pageKind === "credits" || pageKind === "notifications") ? (
        <section className={styles.panelGrid}>
          <article className={styles.panel}>
            <div className={styles.panelHead}>
              <span>Recent usage activity</span>
              <h2>Ledger activity</h2>
              <p>Credit grants, included usage, paid credits, resets, and account adjustments appear here.</p>
            </div>
            <div className={styles.rows}>
              {(usage?.ledger || []).slice(0, 6).map((row, index) => (
                <div className={styles.row} data-status="live" key={row.id || index}>
                  <b>{ledgerTitle(row)}</b>
                  <span>{formatCredits(row.amount)} credits · {formatDateTime(row.created_at)}</span>
                  <i>Saved</i>
                </div>
              ))}
              {usage?.ledger?.length ? null : <div className={styles.emptyState}>No usage activity has been recorded yet.</div>}
            </div>
          </article>
          <article className={styles.panel}>
            <div className={styles.panelHead}>
              <span>Account alerts</span>
              <h2>Notifications</h2>
              <p>Limit, reset, balance, spend, and auto-reload alerts link back to this usage state.</p>
            </div>
            <div className={styles.rows}>
              {(usage?.notifications || []).slice(0, 6).map((item, index) => (
                <div className={styles.row} data-status="setup" key={item.id || index}>
                  <b>{sanitizeMessage(item.title || "Account notification")}</b>
                  <span>{sanitizeMessage(item.message || "Review your usage settings.")}</span>
                  <i>Alert</i>
                </div>
              ))}
              {usage?.notifications?.length ? null : <div className={styles.emptyState}>No account alerts yet.</div>}
            </div>
          </article>
        </section>
      ) : null}

      <section className={styles.sectionVisible}>
        <div className={styles.panelHead}>
          <span>{config.badge}</span>
          <h2>{config.narrative}</h2>
          <p>{loading ? "Loading account usage..." : "Only user-facing account states are shown here."}</p>
        </div>
        <div className={styles.rows}>
          {setupRows.map((row) => (
            <div className={styles.row} data-status={row.status} key={row.label}>
              <b>{row.label}</b>
              <span>{row.value}</span>
              <i>{row.status === "live" ? "Live" : "Ready"}</i>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
