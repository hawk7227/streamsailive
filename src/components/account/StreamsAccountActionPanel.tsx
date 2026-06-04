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
};

type LedgerRow = { id?: string; ledger_type?: string; amount?: number; created_at?: string };
type UsageNotification = { id?: string; title?: string; message?: string; created_at?: string };

type UsageState = {
  ok?: boolean;
  plan?: { name?: string; monthlyPriceUsd?: number; dailyChatMessages?: number; previewAccess?: string };
  account?: { status?: string; paymentMethodStatus?: string };
  session?: UsageCounter;
  daily?: UsageCounter;
  usageCredits?: UsageCredits;
  spend?: { currentMonthSpendUsd?: number; monthlyLimitUsd?: number | null; status?: string };
  autoReload?: { enabled?: boolean; thresholdUsd?: number; topUpUsd?: number; nextCondition?: string };
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
  rows: Array<{ label: string; value: string; status: "live" | "setup" | "off" }>;
  cards: Array<{ label: string; metric: string; title: string; body: string }>;
};

const SAFE_SETUP_MESSAGE =
  "This account control is not fully set up yet. Your current work is safe, but this action cannot run until account usage is connected.";

const CONFIG: Record<PageKind, PageConfig> = {
  overview: {
    eyebrow: "Workspace command center",
    gradient: "blue",
    badge: "Account ready",
    narrative: "Manage plan access, usage, credits, billing controls, and account readiness in one compact Streams view.",
    cards: [
      { label: "Account", metric: "Ready", title: "Workspace access", body: "Plan, identity, and usage controls are organized in one account surface." },
      { label: "Plan", metric: "Connected", title: "Access level", body: "The active plan controls limits, capabilities, and usage credit eligibility." },
      { label: "Usage", metric: "Tracked", title: "Limits and resets", body: "Included session, daily, and monthly usage are tracked separately." },
      { label: "Controls", metric: "Safe", title: "Action readiness", body: "Unavailable controls stay setup-ready instead of showing raw system text." },
    ],
    rows: [
      { label: "Primary account", value: "Personal workspace", status: "live" },
      { label: "Usage controls", value: "Connected to account usage state", status: "live" },
      { label: "Billing controls", value: "Setup-ready until billing is available", status: "setup" },
    ],
  },
  profile: {
    eyebrow: "Identity",
    gradient: "violet",
    badge: "Account",
    narrative: "Review account status, workspace access, and plan-linked limits without exposing internal system details.",
    cards: [
      { label: "Identity", metric: "Owner", title: "Account profile", body: "Display name, email, and workspace identity are grouped here." },
      { label: "Workspace", metric: "Active", title: "Access role", body: "Workspace role and plan access remain tied to the account state." },
      { label: "Session", metric: "Secure", title: "Login status", body: "Session status is shown as user-facing readiness only." },
      { label: "Plan", metric: "Synced", title: "Plan profile", body: "The account plan determines usage and capability limits." },
    ],
    rows: [
      { label: "Profile details", value: "Ready for account identity editing", status: "setup" },
      { label: "Workspace role", value: "Owner", status: "live" },
      { label: "Account access", value: "Active", status: "live" },
    ],
  },
  settings: {
    eyebrow: "Controls",
    gradient: "slate",
    badge: "Setup ready",
    narrative: "Settings controls stay separated from Usage, Billing, and Credits. Only settings-readiness belongs here.",
    cards: [
      { label: "Workspace", metric: "Ready", title: "Default workspace", body: "Choose default workspace behavior, launch preferences, and editor defaults." },
      { label: "Assistant", metric: "Ready", title: "Assistant behavior", body: "Control response style, preview behavior, and default builder mode." },
      { label: "Display", metric: "Ready", title: "Interface preferences", body: "Theme, density, and account display preferences belong here." },
      { label: "Saves", metric: "Pending", title: "Persistence", body: "Save controls remain setup-ready until persistence is connected." },
    ],
    rows: [
      { label: "Default mode", value: "Visual operator", status: "setup" },
      { label: "Inline preview", value: "Concept + progress preview allowed", status: "setup" },
      { label: "Account saves", value: "Setup required", status: "setup" },
    ],
  },
  privacy: {
    eyebrow: "Trust layer",
    gradient: "green",
    badge: "Privacy",
    narrative: "Data controls, privacy settings, and export/delete readiness with polished setup-required states.",
    cards: [
      { label: "Data", metric: "Private", title: "Account data", body: "Review account data controls and retention readiness." },
      { label: "Exports", metric: "Ready", title: "Data export", body: "Export requests stay setup-ready until the export service is connected." },
      { label: "Delete", metric: "Protected", title: "Deletion controls", body: "Destructive actions require a real connected account flow." },
      { label: "Sharing", metric: "Scoped", title: "Workspace access", body: "Workspace access stays owner-scoped unless explicitly shared." },
    ],
    rows: [
      { label: "Data export", value: "Setup required", status: "setup" },
      { label: "Delete account", value: "Protected until connected", status: "setup" },
      { label: "Workspace visibility", value: "Private", status: "live" },
    ],
  },
  billing: {
    eyebrow: "Plan and billing",
    gradient: "gold",
    badge: "Billing",
    narrative: "Manage plan access, billing controls, spend controls, and recent billing activity without duplicating the full Usage page.",
    cards: [],
    rows: [],
  },
  credits: {
    eyebrow: "Usage credits",
    gradient: "cyan",
    badge: "Credits",
    narrative: "Track paid usage credit balance, auto-reload, credit packs, and recent credit activity without duplicating Settings.",
    cards: [],
    rows: [],
  },
  usage: {
    eyebrow: "Account usage",
    gradient: "cyan",
    badge: "Usage live",
    narrative: "See included usage, daily limits, paid usage credits, spend limits, auto-reload, and feature credit costs.",
    cards: [],
    rows: [],
  },
  modules: {
    eyebrow: "Capabilities",
    gradient: "pink",
    badge: "Capabilities",
    narrative: "Review the Streams capability surface and the credit costs tied to premium actions.",
    cards: [
      { label: "Builder", metric: "Core", title: "Business Builder", body: "Draft and final builder actions use separate usage costs." },
      { label: "Studio", metric: "Creative", title: "Image, video, voice", body: "Creative actions use premium credits before execution." },
      { label: "Launch", metric: "Go live", title: "Preview and launch", body: "Launch actions are gated before expensive work begins." },
      { label: "Growth", metric: "Feed", title: "Growth tools", body: "Marketing and content actions use the same usage policy." },
    ],
    rows: [
      { label: "Business Builder", value: "Draft 2 / Final 10", status: "live" },
      { label: "AI Image Studio", value: "Draft 8 / Final 25", status: "live" },
      { label: "Text 2 Video", value: "Draft 75 / Final 220", status: "live" },
    ],
  },
  notifications: {
    eyebrow: "Alerts",
    gradient: "blue",
    badge: "Notifications",
    narrative: "Manage notification preferences and review usage alerts. This page must not duplicate the Usage dashboard.",
    cards: [],
    rows: [],
  },
  personalization: {
    eyebrow: "Assistant style",
    gradient: "violet",
    badge: "Personalization",
    narrative: "Personalization controls are staged in the account system with safe setup-ready states.",
    cards: [
      { label: "Tone", metric: "Ready", title: "Assistant tone", body: "Default response style and tone controls belong here." },
      { label: "Memory", metric: "Scoped", title: "Project memory", body: "Memory preferences remain scoped to account and projects." },
      { label: "Preview", metric: "Ready", title: "Inline preview behavior", body: "Control concept, progress, and artifact preview behavior." },
      { label: "Mode", metric: "Ready", title: "Default mode", body: "Choose the starting workspace mode for new sessions." },
    ],
    rows: [
      { label: "Tone", value: "Setup required", status: "setup" },
      { label: "Memory", value: "Project-scoped", status: "setup" },
      { label: "Preview behavior", value: "Concept + progress", status: "setup" },
    ],
  },
  language: {
    eyebrow: "Region",
    gradient: "blue",
    badge: "Locale",
    narrative: "Language, timezone, and formatting controls are organized for account-level persistence.",
    cards: [
      { label: "Language", metric: "Default", title: "Display language", body: "Language selection is setup-ready." },
      { label: "Timezone", metric: "Ready", title: "Local time", body: "Timezone display is ready for account persistence." },
      { label: "Currency", metric: "Ready", title: "Billing display", body: "Currency display follows account billing settings." },
      { label: "Format", metric: "Ready", title: "Date and number format", body: "Regional formatting belongs here." },
    ],
    rows: [
      { label: "Language", value: "Default", status: "setup" },
      { label: "Timezone", value: "Local", status: "setup" },
      { label: "Currency", value: "USD", status: "setup" },
    ],
  },
  apps: {
    eyebrow: "Connected systems",
    gradient: "green",
    badge: "Connectors",
    narrative: "Connectors and app connections stay user-facing and setup-ready until each connection is live.",
    cards: [
      { label: "Projects", metric: "Ready", title: "Project connections", body: "Project connection status belongs here." },
      { label: "GitHub", metric: "Ready", title: "Code workspace", body: "Repository connection controls are setup-ready." },
      { label: "Domains", metric: "Ready", title: "Launch connections", body: "Domain and hosting setup controls belong here." },
      { label: "Apps", metric: "Ready", title: "Installed apps", body: "Connected apps will appear here when linked." },
    ],
    rows: [
      { label: "GitHub", value: "Setup required", status: "setup" },
      { label: "Domains", value: "Setup required", status: "setup" },
      { label: "Installed apps", value: "None connected", status: "off" },
    ],
  },
  storage: {
    eyebrow: "Storage",
    gradient: "slate",
    badge: "Storage",
    narrative: "Manage account storage readiness, saved work, exports, and retained project assets.",
    cards: [
      { label: "Assets", metric: "Ready", title: "Saved media", body: "Generated assets and uploads will be summarized here." },
      { label: "Projects", metric: "Ready", title: "Project files", body: "Project storage controls are setup-ready." },
      { label: "Exports", metric: "Ready", title: "Download history", body: "Exports and downloads are grouped separately." },
      { label: "Limits", metric: "Plan", title: "Storage limit", body: "Storage limits follow the active account plan." },
    ],
    rows: [
      { label: "Saved assets", value: "Setup required", status: "setup" },
      { label: "Exports", value: "Setup required", status: "setup" },
      { label: "Storage limit", value: "Plan based", status: "setup" },
    ],
  },
  security: {
    eyebrow: "Security",
    gradient: "green",
    badge: "Security",
    narrative: "Review login, session, workspace access, and security readiness without exposing internal details.",
    cards: [
      { label: "Login", metric: "Secure", title: "Account session", body: "Session status and login controls belong here." },
      { label: "Access", metric: "Owner", title: "Workspace access", body: "Workspace access is owner-scoped by default." },
      { label: "Devices", metric: "Ready", title: "Device sessions", body: "Device session review is setup-ready." },
      { label: "Protection", metric: "Ready", title: "Security checks", body: "Security alerts will appear here when connected." },
    ],
    rows: [
      { label: "Workspace role", value: "Owner", status: "live" },
      { label: "Device sessions", value: "Setup required", status: "setup" },
      { label: "Security alerts", value: "Setup required", status: "setup" },
    ],
  },
  keyboard: {
    eyebrow: "Keyboard",
    gradient: "slate",
    badge: "Shortcuts",
    narrative: "Keyboard shortcuts and productivity controls are kept clean and ready for account persistence.",
    cards: [
      { label: "Command", metric: "Ready", title: "Command menu", body: "Shortcut controls are organized here." },
      { label: "Editor", metric: "Ready", title: "Editor shortcuts", body: "Editor keyboard behavior belongs here." },
      { label: "Chat", metric: "Ready", title: "Chat shortcuts", body: "Chat send and navigation shortcuts are setup-ready." },
      { label: "Accessibility", metric: "Ready", title: "Keyboard access", body: "Keyboard accessibility controls belong here." },
    ],
    rows: [
      { label: "Command menu", value: "Setup required", status: "setup" },
      { label: "Editor shortcuts", value: "Setup required", status: "setup" },
      { label: "Chat shortcuts", value: "Setup required", status: "setup" },
    ],
  },
  gift: {
    eyebrow: "Growth loop",
    gradient: "gold",
    badge: "Invites",
    narrative: "Invite and gift-credit flows remain setup-ready until real account credit handling is connected.",
    cards: [
      { label: "Invites", metric: "Ready", title: "Invite links", body: "Invite link creation is setup-ready." },
      { label: "Gift", metric: "Ready", title: "Gift credits", body: "Gift credits require real account credit handling." },
      { label: "Rewards", metric: "Ready", title: "Referral rewards", body: "Referral rewards stay separated from paid usage credits." },
      { label: "Activity", metric: "Ready", title: "Invite activity", body: "Invite activity will appear here when connected." },
    ],
    rows: [
      { label: "Invite links", value: "Setup required", status: "setup" },
      { label: "Gift credits", value: "Setup required", status: "setup" },
      { label: "Referral rewards", value: "Setup required", status: "setup" },
    ],
  },
  help: {
    eyebrow: "Support",
    gradient: "slate",
    badge: "Help",
    narrative: "Find account support, usage guidance, and safe setup-required states for unavailable controls.",
    cards: [
      { label: "Guide", metric: "Ready", title: "Usage guide", body: "Learn how limits, credits, and resets work." },
      { label: "Support", metric: "Ready", title: "Contact support", body: "Support ticket controls are setup-ready." },
      { label: "Status", metric: "Ready", title: "System status", body: "Status summaries remain user-facing." },
      { label: "FAQ", metric: "Ready", title: "Account FAQ", body: "Help content belongs here instead of account controls." },
    ],
    rows: [
      { label: "Usage guide", value: "Available", status: "live" },
      { label: "Support tickets", value: "Setup required", status: "setup" },
      { label: "Account FAQ", value: "Ready", status: "live" },
    ],
  },
  learnMore: {
    eyebrow: "Product education",
    gradient: "cyan",
    badge: "Learn",
    narrative: "Learn how Streams usage, feature costs, billing controls, and plan limits work together.",
    cards: [
      { label: "Usage", metric: "Guide", title: "Included usage", body: "Included usage resets on the account window." },
      { label: "Credits", metric: "Guide", title: "Usage credits", body: "Paid credits continue eligible actions after included usage." },
      { label: "Controls", metric: "Guide", title: "Spend controls", body: "Spend controls protect monthly usage-credit spend." },
      { label: "Actions", metric: "Guide", title: "Premium actions", body: "Premium actions are checked before execution." },
    ],
    rows: [
      { label: "Included usage", value: "Session and daily limits", status: "live" },
      { label: "Usage credits", value: "Paid plans only", status: "live" },
      { label: "Spend controls", value: "Monthly cap", status: "live" },
    ],
  },
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
    .replace(/backend/gi, "account system")
    .replace(/portal/gi, "billing center");
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

function SetupPage({ config }: { config: PageConfig }) {
  return (
    <>
      <section className={styles.grid}>
        {config.cards.map((card) => (
          <article className={styles.card} key={card.title}>
            <span>{card.label}</span>
            <strong>{card.metric}</strong>
            <h3>{card.title}</h3>
            <p>{card.body}</p>
          </article>
        ))}
      </section>
      <section className={styles.sectionVisible}>
        <div className={styles.panelHead}>
          <span>{config.badge}</span>
          <h2>{config.narrative}</h2>
          <p>This page is intentionally separate from the Usage and Billing dashboards.</p>
        </div>
        <div className={styles.rows}>
          {config.rows.map((row) => (
            <div className={styles.row} data-status={row.status} key={row.label}>
              <b>{row.label}</b>
              <span>{row.value}</span>
              <i>{row.status === "live" ? "Live" : row.status === "off" ? "Off" : "Ready"}</i>
            </div>
          ))}
        </div>
      </section>
    </>
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
  const isUsagePage = pageKind === "usage";
  const isBillingPage = pageKind === "billing";
  const isCreditsPage = pageKind === "credits";
  const isNotificationsPage = pageKind === "notifications";
  const isModulesPage = pageKind === "modules";
  const usesUsageData = isUsagePage || isBillingPage || isCreditsPage || isNotificationsPage || isModulesPage;

  const heroActions = [
    ...(isBillingPage ? [
      { label: "Open billing center", action: openAccountBilling, disabled: false },
      { label: "Set up plan", action: () => startPlanSetup("plan"), disabled: false },
    ] : []),
    ...(isCreditsPage ? [
      { label: "Add usage credits", action: () => startPlanSetup("credits"), disabled: false },
      { label: credits.enabled ? "Usage credits on" : "Turn on usage credits", action: () => updateUsageSettings({ paidUsageEnabled: true }, "Usage credits turned on."), disabled: Boolean(credits.enabled) },
      { label: autoReload.enabled ? "Auto-reload on" : "Enable auto-reload", action: () => updateUsageSettings({ autoReloadEnabled: true }, "Auto-reload enabled."), disabled: Boolean(autoReload.enabled) },
    ] : []),
    ...(isUsagePage || isBillingPage || isCreditsPage || isNotificationsPage ? [{ label: "Refresh usage", action: loadUsage, disabled: false }] : []),
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
            <span>{usesUsageData ? planName : "Separate page"}</span>
            <span>{loading && usesUsageData ? "Loading" : "Ready"}</span>
          </div>
        </div>
        {heroActions.length ? (
          <div className={styles.heroActions}>
            {heroActions.map((item) => (
              <button key={item.label} type="button" onClick={item.action} disabled={busy || item.disabled}>
                {busy ? "Working..." : item.label}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {error && usesUsageData ? <section className={styles.error}>{error}</section> : null}
      {!error && notice && usesUsageData ? <section className={styles.notice}>{notice}</section> : null}

      {!usesUsageData ? <SetupPage config={config} /> : null}

      {isUsagePage ? (
        <>
          <section className={styles.grid}>
            <article className={styles.card}><span>Current plan</span><strong>{planName}</strong><h3>{formatMoney(usage?.plan?.monthlyPriceUsd || 0)} / month</h3><p>{usage?.plan?.previewAccess || "Account access is being prepared."}</p></article>
            <article className={styles.card}><span>Session usage</span><strong>{formatCredits(session.available)}</strong><h3>Included credits available</h3><p>Resets {formatDateTime(session.resetAt)}.</p></article>
            <article className={styles.card}><span>Daily usage</span><strong>{formatCredits(daily.available)}</strong><h3>Credits available today</h3><p>{formatCredits(daily.used)} used today.</p></article>
            <article className={styles.card}><span>Monthly included</span><strong>{formatCredits(credits.includedMonthlyAvailable)}</strong><h3>Included credits left</h3><p>{formatCredits(credits.includedMonthlyUsed)} used this month.</p></article>
          </section>
          <section className={styles.panelGrid}>
            <article className={styles.panel}><div className={styles.panelHead}><span>Plan usage limits</span><h2>Included session usage</h2><p>{usage?.messages?.approachingIncludedLimit || "Session usage resets automatically in the current window."}</p></div><ProgressLine label="Current session" used={session.used} limit={session.limit} helper={`${formatCredits(session.available)} available · resets ${formatDateTime(session.resetAt)}`} /><ProgressLine label="Monthly included" used={credits.includedMonthlyUsed} limit={credits.includedMonthlyGranted} helper={`${formatCredits(credits.includedMonthlyAvailable)} included credits available`} /></article>
            <article className={styles.panel}><div className={styles.panelHead}><span>Daily limits</span><h2>Today’s usage</h2><p>Operator, studio, video, and launch usage share your daily plan allowance.</p></div><ProgressLine label="Daily usage" used={daily.used} limit={daily.limit} helper={`${formatCredits(daily.available)} credits available today`} /><div className={styles.compactStats}><b>Operator {formatCredits(daily.operatorUsed)}</b><b>Studio {formatCredits(daily.studioUsed)}</b><b>Video {formatCredits(daily.videoUsed)}</b><b>Launch {formatCredits(daily.launchUsed)}</b></div></article>
          </section>
        </>
      ) : null}

      {isBillingPage ? (
        <>
          <section className={styles.grid}>
            <article className={styles.card}><span>Current plan</span><strong>{planName}</strong><h3>{formatMoney(usage?.plan?.monthlyPriceUsd || 0)} / month</h3><p>Manage plan access and billing setup here.</p></article>
            <article className={styles.card}><span>Spend limit</span><strong>{monthlyLimitLabel}</strong><h3>{formatMoney(spend.currentMonthSpendUsd || 0)} used this month</h3><p>{spend.status === "limit_reached" ? "Monthly spend limit reached." : "Spend controls are active."}</p></article>
            <article className={styles.card}><span>Payment method</span><strong>{usage?.account?.paymentMethodStatus === "ready" ? "Ready" : "Needed"}</strong><h3>Billing setup</h3><p>Add a payment method to turn on usage credits or auto-reload.</p></article>
            <article className={styles.card}><span>Plan controls</span><strong>Ready</strong><h3>Upgrade path</h3><p>Set up or manage your plan from the billing center.</p></article>
          </section>
          <section className={styles.panelGrid}>
            <article className={styles.panel}><div className={styles.panelHead}><span>Billing controls</span><h2>Plan management</h2><p>Open the billing center or set up a plan when billing is connected.</p></div><div className={styles.rows}><div className={styles.row} data-status="setup"><b>Billing center</b><span>Ready to open when connected</span><i>Ready</i></div><div className={styles.row} data-status="setup"><b>Plan setup</b><span>Upgrade or change plan</span><i>Ready</i></div><div className={styles.row} data-status="live"><b>Current plan</b><span>{planName}</span><i>Live</i></div></div></article>
            <article className={styles.panel}><div className={styles.panelHead}><span>Spend controls</span><h2>Monthly usage-credit cap</h2><p>Spend controls protect paid usage credits after included usage is exhausted.</p></div><div className={styles.rows}><div className={styles.row} data-status="live"><b>Monthly limit</b><span>{monthlyLimitLabel}</span><i>Live</i></div><div className={styles.row} data-status="live"><b>Used this month</b><span>{formatMoney(spend.currentMonthSpendUsd || 0)}</span><i>Live</i></div><div className={styles.row} data-status={spend.status === "limit_reached" ? "setup" : "live"}><b>Status</b><span>{spend.status === "limit_reached" ? "Limit reached" : "Active"}</span><i>{spend.status === "limit_reached" ? "Alert" : "Live"}</i></div></div></article>
          </section>
        </>
      ) : null}

      {isCreditsPage ? (
        <>
          <section className={styles.grid}>
            <article className={styles.card}><span>Credits available</span><strong>{formatCredits(credits.available)}</strong><h3>{credits.enabled ? "Usage credits on" : "Usage credits off"}</h3><p>{credits.eligible ? "Paid plans can continue with usage credits after included usage." : "Free plans can wait for reset or upgrade."}</p></article>
            <article className={styles.card}><span>Credits received</span><strong>{formatCredits(credits.received)}</strong><h3>Total paid credits</h3><p>Purchased and granted paid usage credits.</p></article>
            <article className={styles.card}><span>Credits used</span><strong>{formatCredits(credits.used)}</strong><h3>Paid usage spent</h3><p>Paid credits used after included limits.</p></article>
            <article className={styles.card}><span>Auto-reload</span><strong>{autoReload.enabled ? "On" : "Off"}</strong><h3>{formatMoney(autoReload.thresholdUsd || 0)} threshold</h3><p>{formatMoney(autoReload.topUpUsd || 0)} reload amount.</p></article>
          </section>
          <section className={styles.panelGrid}>
            <article className={styles.panel}><div className={styles.panelHead}><span>Usage credits</span><h2>Paid credit balance</h2><p>{usage?.messages?.lowBalance || "Add credits or turn on auto-reload to keep building without interruption."}</p></div><div className={styles.rows}><div className={styles.row} data-status="live"><b>Credits received</b><span>{formatCredits(credits.received)}</span><i>Live</i></div><div className={styles.row} data-status="live"><b>Credits used</b><span>{formatCredits(credits.used)}</span><i>Live</i></div><div className={styles.row} data-status="live"><b>Credits available</b><span>{formatCredits(credits.available)}</span><i>Live</i></div><div className={styles.row} data-status={credits.enabled ? "live" : "setup"}><b>Paid usage credits</b><span>{credits.enabled ? "Enabled" : credits.eligible ? "Ready to enable" : "Upgrade required"}</span><i>{credits.enabled ? "On" : "Setup"}</i></div></div></article>
            <article className={styles.panel}><div className={styles.panelHead}><span>Auto-reload</span><h2>{autoReload.enabled ? "Auto-reload enabled" : "Auto-reload off"}</h2><p>{usage?.messages?.autoReloadSetup || "You control the threshold, top-up amount, and monthly spend limit."}</p></div><div className={styles.rows}><div className={styles.row} data-status={autoReload.enabled ? "live" : "off"}><b>Status</b><span>{autoReload.enabled ? "Enabled" : "Disabled"}</span><i>{autoReload.enabled ? "On" : "Off"}</i></div><div className={styles.row} data-status="setup"><b>Reload threshold</b><span>{formatMoney(autoReload.thresholdUsd || 0)}</span><i>Set</i></div><div className={styles.row} data-status="setup"><b>Reload amount</b><span>{formatMoney(autoReload.topUpUsd || 0)}</span><i>Set</i></div></div></article>
          </section>
        </>
      ) : null}

      {(isUsagePage || isCreditsPage || isModulesPage) ? (
        <section className={styles.sectionVisible}>
          <div className={styles.panelHead}><span>Feature usage costs</span><h2>Premium action cost guide</h2><p>Draft actions use fewer credits. Final generation, launch, video, and code actions use more credits before execution.</p></div>
          <div className={styles.costTable}>{(usage?.featureCosts || []).map((item) => (<div key={item.key}><b>{item.label}</b><span>Draft {formatCredits(item.draft)}</span><span>Final {formatCredits(item.final)}</span></div>))}</div>
        </section>
      ) : null}

      {isNotificationsPage ? (
        <section className={styles.panelGrid}>
          <article className={styles.panel}><div className={styles.panelHead}><span>Notification preferences</span><h2>Delivery controls</h2><p>Delivery settings stay setup-ready until notification delivery is connected.</p></div><div className={styles.rows}><div className={styles.row} data-status="setup"><b>Usage alerts</b><span>Near limit, reached limit, and reset alerts</span><i>Ready</i></div><div className={styles.row} data-status="setup"><b>Credit alerts</b><span>Low balance and usage-credit activity</span><i>Ready</i></div><div className={styles.row} data-status="setup"><b>Billing alerts</b><span>Spend limit and payment method reminders</span><i>Ready</i></div><div className={styles.row} data-status="off"><b>Email delivery</b><span>Delivery not connected yet</span><i>Off</i></div></div></article>
          <article className={styles.panel}><div className={styles.panelHead}><span>Recent account alerts</span><h2>Saved alerts</h2><p>Limit, reset, balance, spend, and auto-reload alerts link back to usage state.</p></div><div className={styles.rows}>{(usage?.notifications || []).slice(0, 8).map((item, index) => (<div className={styles.row} data-status="setup" key={item.id || index}><b>{sanitizeMessage(item.title || "Account notification")}</b><span>{sanitizeMessage(item.message || "Review your usage settings.")}</span><i>Alert</i></div>))}{usage?.notifications?.length ? null : <div className={styles.emptyState}>No account alerts yet.</div>}</div></article>
        </section>
      ) : null}

      {(isUsagePage || isBillingPage || isCreditsPage) ? (
        <section className={styles.panelGrid}>
          <article className={styles.panel}><div className={styles.panelHead}><span>Recent usage activity</span><h2>Ledger activity</h2><p>Credit grants, included usage, paid credits, resets, and account adjustments appear here.</p></div><div className={styles.rows}>{(usage?.ledger || []).slice(0, 6).map((row, index) => (<div className={styles.row} data-status="live" key={row.id || index}><b>{ledgerTitle(row)}</b><span>{formatCredits(row.amount)} credits · {formatDateTime(row.created_at)}</span><i>Saved</i></div>))}{usage?.ledger?.length ? null : <div className={styles.emptyState}>No usage activity has been recorded yet.</div>}</div></article>
          <article className={styles.panel}><div className={styles.panelHead}><span>Account alerts</span><h2>Notifications</h2><p>Usage, spend, balance, and reset alerts appear here.</p></div><div className={styles.rows}>{(usage?.notifications || []).slice(0, 6).map((item, index) => (<div className={styles.row} data-status="setup" key={item.id || index}><b>{sanitizeMessage(item.title || "Account notification")}</b><span>{sanitizeMessage(item.message || "Review your usage settings.")}</span><i>Alert</i></div>))}{usage?.notifications?.length ? null : <div className={styles.emptyState}>No account alerts yet.</div>}</div></article>
        </section>
      ) : null}
    </main>
  );
}
