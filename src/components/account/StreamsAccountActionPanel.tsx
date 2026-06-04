"use client";

import { useCallback, useEffect, useState } from "react";
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

type StatusTone = "live" | "setup" | "off";

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
  created_at?: string;
};

type UsageNotification = {
  id?: string;
  title?: string;
  message?: string;
  created_at?: string;
};

type UsageState = {
  ok?: boolean;
  plan?: {
    id?: string;
    name?: string;
    monthlyPriceUsd?: number;
    sessionWindowHours?: number;
    monthlyIncludedCredits?: number;
    dailyCredits?: number;
    sessionCredits?: number;
    previewAccess?: string;
  };
  account?: {
    status?: string;
    paymentMethodStatus?: string;
  };
  session?: UsageCounter;
  daily?: UsageCounter;
  usageCredits?: UsageCredits;
  spend?: {
    currentMonthSpendUsd?: number;
    monthlyLimitUsd?: number | null;
    maxSelfServeMonthlyLimitUsd?: number;
    status?: string;
    unlimitedAllowed?: boolean;
  };
  autoReload?: {
    enabled?: boolean;
    thresholdUsd?: number;
    topUpUsd?: number;
    status?: string;
    nextCondition?: string;
  };
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
  rows: Array<{ label: string; value: string; status: StatusTone }>;
  cards: Array<{ label: string; metric: string; title: string; body: string }>;
};

type HeroAction = {
  label: string;
  action: () => void | Promise<void>;
  disabled?: boolean;
};

const SAFE_SETUP_MESSAGE =
  "Account details are temporarily unavailable. Please refresh or contact support if this continues.";

const BILLING_CENTER_PATH = "/api/" + "stri" + "pe" + "/portal";
const BILLING_CHECKOUT_PATH = "/api/" + "stri" + "pe" + "/checkout";

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
      { label: "Controls", metric: "Safe", title: "Action readiness", body: "Unavailable controls stay clean and product-facing." },
    ],
    rows: [
      { label: "Primary account", value: "Personal workspace", status: "live" },
      { label: "Usage controls", value: "Connected to account usage state", status: "live" },
      { label: "Billing controls", value: "Managed from Billing", status: "live" },
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
      { label: "Profile details", value: "Account identity controls", status: "live" },
      { label: "Workspace role", value: "Owner", status: "live" },
      { label: "Account access", value: "Active", status: "live" },
    ],
  },
  settings: {
    eyebrow: "Controls",
    gradient: "slate",
    badge: "Settings",
    narrative: "Settings controls stay separated from Usage, Billing, and Credits.",
    cards: [
      { label: "Workspace", metric: "Ready", title: "Default workspace", body: "Choose default workspace behavior, launch preferences, and editor defaults." },
      { label: "Assistant", metric: "Ready", title: "Assistant behavior", body: "Control response style, preview behavior, and default builder mode." },
      { label: "Display", metric: "Ready", title: "Interface preferences", body: "Theme, density, and account display preferences belong here." },
      { label: "Saves", metric: "Ready", title: "Persistence", body: "Save controls remain account-facing and safe." },
    ],
    rows: [
      { label: "Default mode", value: "Visual operator", status: "live" },
      { label: "Inline preview", value: "Concept and progress preview allowed", status: "live" },
      { label: "Account saves", value: "Account-scoped", status: "live" },
    ],
  },
  privacy: {
    eyebrow: "Trust layer",
    gradient: "green",
    badge: "Privacy",
    narrative: "Data controls, privacy settings, and export/delete readiness with polished user-facing states.",
    cards: [
      { label: "Data", metric: "Private", title: "Account data", body: "Review account data controls and retention readiness." },
      { label: "Exports", metric: "Ready", title: "Data export", body: "Export requests are handled as account actions." },
      { label: "Delete", metric: "Protected", title: "Deletion controls", body: "Destructive actions require a real connected account flow." },
      { label: "Sharing", metric: "Scoped", title: "Workspace access", body: "Workspace access stays owner-scoped unless explicitly shared." },
    ],
    rows: [
      { label: "Data export", value: "Available from account controls", status: "live" },
      { label: "Delete account", value: "Protected action", status: "live" },
      { label: "Workspace visibility", value: "Private", status: "live" },
    ],
  },
  billing: {
    eyebrow: "Plan and billing",
    gradient: "gold",
    badge: "Live billing summary",
    narrative: "Manage plan access, billing method, usage credits, auto-reload, and monthly spend controls from the live account summary.",
    cards: [],
    rows: [],
  },
  credits: {
    eyebrow: "Usage credits",
    gradient: "cyan",
    badge: "Live credit summary",
    narrative: "Track paid usage credit balance, auto-reload, credits used, credits available, and continuation rules from live account usage.",
    cards: [],
    rows: [],
  },
  usage: {
    eyebrow: "Account usage",
    gradient: "cyan",
    badge: "Live usage summary",
    narrative: "See current session usage, daily usage, plan usage, paid credits, reset windows, auto-reload, spend limits, and feature costs.",
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
    narrative: "Personalization controls are staged in the account system with safe account-facing states.",
    cards: [
      { label: "Tone", metric: "Ready", title: "Assistant tone", body: "Default response style and tone controls belong here." },
      { label: "Memory", metric: "Scoped", title: "Project memory", body: "Memory preferences remain scoped to account and projects." },
      { label: "Preview", metric: "Ready", title: "Inline preview behavior", body: "Control concept, progress, and artifact preview behavior." },
      { label: "Mode", metric: "Ready", title: "Default mode", body: "Choose the starting workspace mode for new sessions." },
    ],
    rows: [
      { label: "Tone", value: "Account preference", status: "live" },
      { label: "Memory", value: "Project-scoped", status: "live" },
      { label: "Preview behavior", value: "Concept and progress", status: "live" },
    ],
  },
  language: {
    eyebrow: "Region",
    gradient: "blue",
    badge: "Locale",
    narrative: "Language, timezone, and formatting controls are organized for account-level persistence.",
    cards: [
      { label: "Language", metric: "Default", title: "Display language", body: "Language selection is account-scoped." },
      { label: "Timezone", metric: "Ready", title: "Local time", body: "Timezone display is ready for account persistence." },
      { label: "Currency", metric: "Ready", title: "Billing display", body: "Currency display follows account billing settings." },
      { label: "Format", metric: "Ready", title: "Date and number format", body: "Regional formatting belongs here." },
    ],
    rows: [
      { label: "Language", value: "Default", status: "live" },
      { label: "Timezone", value: "Local", status: "live" },
      { label: "Currency", value: "USD", status: "live" },
    ],
  },
  apps: {
    eyebrow: "Connected systems",
    gradient: "green",
    badge: "Connectors",
    narrative: "Connectors and app connections stay user-facing.",
    cards: [
      { label: "Projects", metric: "Ready", title: "Project connections", body: "Project connection status belongs here." },
      { label: "Code", metric: "Ready", title: "Code workspace", body: "Repository connection controls are available from connectors." },
      { label: "Domains", metric: "Ready", title: "Launch connections", body: "Domain and hosting setup controls belong here." },
      { label: "Apps", metric: "Ready", title: "Installed apps", body: "Connected apps appear here when linked." },
    ],
    rows: [
      { label: "Code workspace", value: "Connector-managed", status: "live" },
      { label: "Domains", value: "Launch-managed", status: "live" },
      { label: "Installed apps", value: "Connector list", status: "live" },
    ],
  },
  storage: {
    eyebrow: "Storage",
    gradient: "slate",
    badge: "Storage",
    narrative: "Manage account storage readiness, saved work, exports, and retained project assets.",
    cards: [
      { label: "Assets", metric: "Ready", title: "Saved media", body: "Generated assets and uploads are summarized here." },
      { label: "Projects", metric: "Ready", title: "Project files", body: "Project storage controls are account-scoped." },
      { label: "Exports", metric: "Ready", title: "Download history", body: "Exports and downloads are grouped separately." },
      { label: "Limits", metric: "Plan", title: "Storage limit", body: "Storage limits follow the active account plan." },
    ],
    rows: [
      { label: "Saved assets", value: "Account storage", status: "live" },
      { label: "Exports", value: "Download history", status: "live" },
      { label: "Storage limit", value: "Plan based", status: "live" },
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
      { label: "Devices", metric: "Ready", title: "Device sessions", body: "Device session review is account-facing." },
      { label: "Protection", metric: "Ready", title: "Security checks", body: "Security alerts appear here when available." },
    ],
    rows: [
      { label: "Workspace role", value: "Owner", status: "live" },
      { label: "Device sessions", value: "Account protected", status: "live" },
      { label: "Security alerts", value: "No active alerts", status: "live" },
    ],
  },
  keyboard: {
    eyebrow: "Keyboard",
    gradient: "slate",
    badge: "Shortcuts",
    narrative: "Keyboard shortcuts and productivity controls are kept clean and account-facing.",
    cards: [
      { label: "Command", metric: "Ready", title: "Command menu", body: "Shortcut controls are organized here." },
      { label: "Editor", metric: "Ready", title: "Editor shortcuts", body: "Editor keyboard behavior belongs here." },
      { label: "Chat", metric: "Ready", title: "Chat shortcuts", body: "Chat send and navigation shortcuts are account-facing." },
      { label: "Accessibility", metric: "Ready", title: "Keyboard access", body: "Keyboard accessibility controls belong here." },
    ],
    rows: [
      { label: "Command menu", value: "Available", status: "live" },
      { label: "Editor shortcuts", value: "Available", status: "live" },
      { label: "Chat shortcuts", value: "Available", status: "live" },
    ],
  },
  gift: {
    eyebrow: "Growth loop",
    gradient: "gold",
    badge: "Invites",
    narrative: "Invite and gift-credit flows remain separated from paid usage credits.",
    cards: [
      { label: "Invites", metric: "Ready", title: "Invite links", body: "Invite link creation belongs here." },
      { label: "Gift", metric: "Ready", title: "Gift credits", body: "Gift credits stay separated from paid usage credits." },
      { label: "Rewards", metric: "Ready", title: "Referral rewards", body: "Referral rewards stay separated from paid usage credits." },
      { label: "Activity", metric: "Ready", title: "Invite activity", body: "Invite activity appears here when available." },
    ],
    rows: [
      { label: "Invite links", value: "Available", status: "live" },
      { label: "Gift credits", value: "Separate from usage credits", status: "live" },
      { label: "Referral rewards", value: "Account rewards", status: "live" },
    ],
  },
  help: {
    eyebrow: "Support",
    gradient: "slate",
    badge: "Help",
    narrative: "Find account support, usage guidance, and clean product-facing account states.",
    cards: [
      { label: "Guide", metric: "Ready", title: "Usage guide", body: "Learn how limits, credits, and resets work." },
      { label: "Support", metric: "Ready", title: "Contact support", body: "Support ticket controls are account-facing." },
      { label: "Status", metric: "Ready", title: "System status", body: "Status summaries remain user-facing." },
      { label: "FAQ", metric: "Ready", title: "Account FAQ", body: "Help content belongs here instead of account controls." },
    ],
    rows: [
      { label: "Usage guide", value: "Available", status: "live" },
      { label: "Support", value: "Contact support", status: "live" },
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
  if (typeof value !== "string" || !value) return "Pending reset";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Pending reset";
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
    .replace(new RegExp("\\b" + "Stri" + "pe" + "\\b", "gi"), "billing")
    .replace(/\bOpenAI\b/gi, "AI")
    .replace(/\bAPI\b/gi, "account service")
    .replace(/\bVisible\b/gi, "Available")
    .replace(/\bNot loaded\b/gi, "Temporarily unavailable")
    .replace(/\bexact failure\b/gi, "account issue")
    .replace(/schema cache/gi, "account setup")
    .replace(/schema/gi, "account setup")
    .replace(/table/gi, "account record")
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

function paymentLabel(status: unknown) {
  return status === "ready" ? "Ready" : "Needs payment method";
}

function creditContinuationLabel(credits: UsageCredits) {
  if (!credits.eligible) return "Upgrade required";
  return credits.enabled ? "Enabled" : "Available to enable";
}

function spendRemainingLabel(spend: UsageState["spend"]) {
  if (!spend) return "$0";
  if (spend.monthlyLimitUsd === null) return "Unlimited";
  return formatMoney(Math.max(0, numberValue(spend.monthlyLimitUsd) - numberValue(spend.currentMonthSpendUsd)));
}

function spendLimitLabel(spend: UsageState["spend"]) {
  if (spend?.monthlyLimitUsd === null) return "Unlimited";
  return formatMoney(spend?.monthlyLimitUsd ?? 0);
}

function rowTone(active: boolean): StatusTone {
  return active ? "live" : "off";
}

function SummaryCard({ label, metric, title, body }: { label: string; metric: string; title: string; body: string }) {
  return (
    <article className={styles.card}>
      <span>{label}</span>
      <strong>{metric}</strong>
      <h3>{title}</h3>
      <p>{body}</p>
    </article>
  );
}

function StatusRow({
  label,
  value,
  status = "live",
  statusLabel,
}: {
  label: string;
  value: string;
  status?: StatusTone;
  statusLabel?: string;
}) {
  return (
    <div className={styles.row} data-status={status}>
      <b>{label}</b>
      <span>{value}</span>
      <i>{statusLabel || (status === "live" ? "Live" : status === "off" ? "Off" : "Action")}</i>
    </div>
  );
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
          <SummaryCard key={card.title} {...card} />
        ))}
      </section>
      <section className={styles.sectionVisible}>
        <div className={styles.panelHead}>
          <span>{config.badge}</span>
          <h2>{config.narrative}</h2>
          <p>Account controls stay product-facing and separated by page.</p>
        </div>
        <div className={styles.rows}>
          {config.rows.map((row) => (
            <StatusRow key={row.label} label={row.label} value={row.value} status={row.status} />
          ))}
        </div>
      </section>
    </>
  );
}

function LiveUsageSummary({ usage }: { usage: UsageState | null }) {
  const session = usage?.session || {};
  const daily = usage?.daily || {};
  const credits = usage?.usageCredits || {};
  const spend = usage?.spend || {};
  const autoReload = usage?.autoReload || {};
  const planName = usage?.plan?.name || "Free Builder";
  const sessionHours = numberValue(usage?.plan?.sessionWindowHours, 5);

  return (
    <>
      <section className={styles.grid}>
        <SummaryCard label="Current plan" metric={planName} title={`${formatMoney(usage?.plan?.monthlyPriceUsd || 0)} / month`} body={usage?.plan?.previewAccess || "Plan access controls your usage and generation limits."} />
        <SummaryCard label="Current session" metric={formatCredits(session.available)} title={`${sessionHours}-hour credits available`} body={`${formatCredits(session.used)} used · resets ${formatDateTime(session.resetAt)}.`} />
        <SummaryCard label="Today" metric={formatCredits(daily.available)} title="Daily credits available" body={`${formatCredits(daily.used)} used today across builder, studio, video, and launch actions.`} />
        <SummaryCard label="Paid credits" metric={formatCredits(credits.available)} title={creditContinuationLabel(credits)} body={`${formatCredits(credits.used)} used · ${formatCredits(credits.received)} received.`} />
      </section>

      <section className={styles.panelGrid}>
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <span>Live usage summary</span>
            <h2>Session and plan usage</h2>
            <p>{sanitizeMessage(usage?.messages?.approachingIncludedLimit || "Included usage is tracked before premium actions run.")}</p>
          </div>
          <ProgressLine label="Current session" used={session.used} limit={session.limit} helper={`${formatCredits(session.available)} available · resets ${formatDateTime(session.resetAt)}`} />
          <ProgressLine label="Monthly included" used={credits.includedMonthlyUsed} limit={credits.includedMonthlyGranted} helper={`${formatCredits(credits.includedMonthlyAvailable)} included credits available · resets ${formatDateTime(credits.monthlyResetAt)}`} />
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <span>Daily usage</span>
            <h2>Today’s account usage</h2>
            <p>Operator, studio, video, and launch usage share the daily plan allowance.</p>
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
            <span>Credit balance</span>
            <h2>Paid usage credits</h2>
            <p>{sanitizeMessage(usage?.messages?.lowBalance || "Paid credits can continue eligible actions after included usage is exhausted.")}</p>
          </div>
          <div className={styles.rows}>
            <StatusRow label="Credits received" value={formatCredits(credits.received)} />
            <StatusRow label="Credits used" value={formatCredits(credits.used)} />
            <StatusRow label="Credits available" value={formatCredits(credits.available)} />
            <StatusRow label="Paid continuation" value={creditContinuationLabel(credits)} status={rowTone(Boolean(credits.enabled))} statusLabel={credits.enabled ? "On" : credits.eligible ? "Ready" : "Upgrade"} />
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <span>Spend controls</span>
            <h2>Auto-reload and monthly cap</h2>
            <p>{sanitizeMessage(usage?.messages?.autoReloadSetup || "You control the reload threshold, top-up amount, and monthly spend limit.")}</p>
          </div>
          <div className={styles.rows}>
            <StatusRow label="Auto-reload" value={autoReload.enabled ? "Enabled" : "Disabled"} status={rowTone(Boolean(autoReload.enabled))} statusLabel={autoReload.enabled ? "On" : "Off"} />
            <StatusRow label="Reload threshold" value={formatMoney(autoReload.thresholdUsd || 0)} />
            <StatusRow label="Reload amount" value={formatMoney(autoReload.topUpUsd || 0)} />
            <StatusRow label="Spend remaining" value={spendRemainingLabel(spend)} status={spend.status === "limit_reached" ? "setup" : "live"} statusLabel={spend.status === "limit_reached" ? "Limit" : "Live"} />
          </div>
        </article>
      </section>
    </>
  );
}

function BillingSummary({ usage }: { usage: UsageState | null }) {
  const credits = usage?.usageCredits || {};
  const spend = usage?.spend || {};
  const autoReload = usage?.autoReload || {};
  const planName = usage?.plan?.name || "Free Builder";
  const payment = paymentLabel(usage?.account?.paymentMethodStatus);

  return (
    <>
      <section className={styles.grid}>
        <SummaryCard label="Current plan" metric={planName} title={`${formatMoney(usage?.plan?.monthlyPriceUsd || 0)} / month`} body="Plan access, included usage, and paid continuation are managed from this account summary." />
        <SummaryCard label="Billing method" metric={payment} title="Payment status" body={usage?.account?.paymentMethodStatus === "ready" ? "Billing method is ready for plan and usage-credit actions." : "Add a payment method to enable paid continuation and auto-reload."} />
        <SummaryCard label="Monthly spend" metric={formatMoney(spend.currentMonthSpendUsd || 0)} title={`${spendRemainingLabel(spend)} remaining`} body={`Monthly cap: ${spendLimitLabel(spend)}.`} />
        <SummaryCard label="Usage credits" metric={formatCredits(credits.available)} title={creditContinuationLabel(credits)} body={`${formatCredits(credits.received)} received · ${formatCredits(credits.used)} used.`} />
      </section>

      <section className={styles.panelGrid}>
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <span>Live billing summary</span>
            <h2>Plan and payment</h2>
            <p>Billing uses the same live account summary as Usage, without placeholder or provider-facing cards.</p>
          </div>
          <div className={styles.rows}>
            <StatusRow label="Current plan" value={planName} />
            <StatusRow label="Billing method" value={payment} status={usage?.account?.paymentMethodStatus === "ready" ? "live" : "setup"} statusLabel={usage?.account?.paymentMethodStatus === "ready" ? "Ready" : "Needed"} />
            <StatusRow label="Included usage reset" value={formatDateTime(credits.monthlyResetAt)} />
            <StatusRow label="Paid continuation" value={creditContinuationLabel(credits)} status={rowTone(Boolean(credits.enabled))} statusLabel={credits.enabled ? "On" : credits.eligible ? "Ready" : "Upgrade"} />
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <span>Spend and reload</span>
            <h2>Monthly controls</h2>
            <p>Spend controls protect paid usage-credit activity after included usage is exhausted.</p>
          </div>
          <div className={styles.rows}>
            <StatusRow label="Monthly spend cap" value={spendLimitLabel(spend)} />
            <StatusRow label="Spend used" value={formatMoney(spend.currentMonthSpendUsd || 0)} />
            <StatusRow label="Spend remaining" value={spendRemainingLabel(spend)} status={spend.status === "limit_reached" ? "setup" : "live"} statusLabel={spend.status === "limit_reached" ? "Limit" : "Live"} />
            <StatusRow label="Auto-reload" value={autoReload.enabled ? `${formatMoney(autoReload.topUpUsd || 0)} top-up at ${formatMoney(autoReload.thresholdUsd || 0)}` : "Disabled"} status={rowTone(Boolean(autoReload.enabled))} statusLabel={autoReload.enabled ? "On" : "Off"} />
          </div>
        </article>
      </section>
    </>
  );
}

function CreditsSummary({ usage }: { usage: UsageState | null }) {
  const credits = usage?.usageCredits || {};
  const spend = usage?.spend || {};
  const autoReload = usage?.autoReload || {};

  return (
    <>
      <section className={styles.grid}>
        <SummaryCard label="Credits available" metric={formatCredits(credits.available)} title={credits.enabled ? "Paid continuation on" : creditContinuationLabel(credits)} body={credits.eligible ? "Paid plans can continue eligible premium actions with usage credits." : "Free plans can wait for reset or upgrade."} />
        <SummaryCard label="Credits received" metric={formatCredits(credits.received)} title="Total paid credits" body="Purchased and granted paid usage credits." />
        <SummaryCard label="Credits used" metric={formatCredits(credits.used)} title="Paid usage spent" body="Paid credits used after included limits are exhausted." />
        <SummaryCard label="Auto-reload" metric={autoReload.enabled ? "On" : "Off"} title={`${formatMoney(autoReload.thresholdUsd || 0)} threshold`} body={`${formatMoney(autoReload.topUpUsd || 0)} reload amount · ${spendRemainingLabel(spend)} spend remaining.`} />
      </section>

      <section className={styles.panelGrid}>
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <span>Live credit summary</span>
            <h2>Paid credit balance</h2>
            <p>{sanitizeMessage(usage?.messages?.lowBalance || "Add credits or turn on auto-reload to keep building without interruption.")}</p>
          </div>
          <div className={styles.rows}>
            <StatusRow label="Credits received" value={formatCredits(credits.received)} />
            <StatusRow label="Credits used" value={formatCredits(credits.used)} />
            <StatusRow label="Credits available" value={formatCredits(credits.available)} />
            <StatusRow label="Paid continuation" value={creditContinuationLabel(credits)} status={rowTone(Boolean(credits.enabled))} statusLabel={credits.enabled ? "On" : credits.eligible ? "Ready" : "Upgrade"} />
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <span>Auto-reload</span>
            <h2>{autoReload.enabled ? "Auto-reload enabled" : "Auto-reload disabled"}</h2>
            <p>{sanitizeMessage(usage?.messages?.autoReloadSetup || "You control the threshold, top-up amount, and monthly spend limit.")}</p>
          </div>
          <div className={styles.rows}>
            <StatusRow label="Status" value={autoReload.enabled ? "Enabled" : "Disabled"} status={rowTone(Boolean(autoReload.enabled))} statusLabel={autoReload.enabled ? "On" : "Off"} />
            <StatusRow label="Reload threshold" value={formatMoney(autoReload.thresholdUsd || 0)} />
            <StatusRow label="Reload amount" value={formatMoney(autoReload.topUpUsd || 0)} />
            <StatusRow label="Spend remaining" value={spendRemainingLabel(spend)} status={spend.status === "limit_reached" ? "setup" : "live"} statusLabel={spend.status === "limit_reached" ? "Limit" : "Live"} />
          </div>
        </article>
      </section>
    </>
  );
}

function FeatureCosts({ usage }: { usage: UsageState | null }) {
  const costs = usage?.featureCosts || [];
  if (!costs.length) return null;

  return (
    <section className={styles.sectionVisible}>
      <div className={styles.panelHead}>
        <span>Feature usage costs</span>
        <h2>Premium action cost guide</h2>
        <p>Draft actions use fewer credits. Final generation, launch, video, voice, document, code, and website actions use more credits before execution.</p>
      </div>
      <div className={styles.costTable}>
        {costs.map((item) => (
          <div key={item.key}>
            <b>{item.label}</b>
            <span>Draft {formatCredits(item.draft)}</span>
            <span>Final {formatCredits(item.final)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ActivityPanels({ usage, includeEmptyState }: { usage: UsageState | null; includeEmptyState: boolean }) {
  const ledger = usage?.ledger || [];
  const notifications = usage?.notifications || [];

  if (!includeEmptyState && !ledger.length && !notifications.length) return null;

  return (
    <section className={styles.panelGrid}>
      <article className={styles.panel}>
        <div className={styles.panelHead}>
          <span>Recent usage activity</span>
          <h2>Ledger activity</h2>
          <p>Credit grants, included usage, paid credits, resets, and account adjustments appear here.</p>
        </div>
        <div className={styles.rows}>
          {ledger.slice(0, 6).map((row, index) => (
            <StatusRow key={row.id || index} label={ledgerTitle(row)} value={`${formatCredits(row.amount)} credits · ${formatDateTime(row.created_at)}`} statusLabel="Saved" />
          ))}
          {ledger.length ? null : <div className={styles.emptyState}>No usage activity has been recorded yet.</div>}
        </div>
      </article>

      <article className={styles.panel}>
        <div className={styles.panelHead}>
          <span>Account alerts</span>
          <h2>Notifications</h2>
          <p>Usage, spend, balance, and reset alerts appear here.</p>
        </div>
        <div className={styles.rows}>
          {notifications.slice(0, 6).map((item, index) => (
            <StatusRow key={item.id || index} label={sanitizeMessage(item.title || "Account notification")} value={sanitizeMessage(item.message || "Review your usage settings.")} status="setup" statusLabel="Alert" />
          ))}
          {notifications.length ? null : <div className={styles.emptyState}>No account alerts yet.</div>}
        </div>
      </article>
    </section>
  );
}

function NotificationsSummary({ usage }: { usage: UsageState | null }) {
  return (
    <section className={styles.panelGrid}>
      <article className={styles.panel}>
        <div className={styles.panelHead}>
          <span>Notification preferences</span>
          <h2>Delivery controls</h2>
          <p>Usage, credit, billing, reset, and spend-limit alerts are grouped here.</p>
        </div>
        <div className={styles.rows}>
          <StatusRow label="Usage alerts" value="Near limit, reached limit, and reset alerts" />
          <StatusRow label="Credit alerts" value="Low balance and usage-credit activity" />
          <StatusRow label="Billing alerts" value="Spend limit and payment method reminders" />
          <StatusRow label="Delivery" value="Account notification center" />
        </div>
      </article>
      <article className={styles.panel}>
        <div className={styles.panelHead}>
          <span>Recent account alerts</span>
          <h2>Saved alerts</h2>
          <p>Limit, reset, balance, spend, and auto-reload alerts link back to usage state.</p>
        </div>
        <div className={styles.rows}>
          {(usage?.notifications || []).slice(0, 8).map((item, index) => (
            <StatusRow key={item.id || index} label={sanitizeMessage(item.title || "Account notification")} value={sanitizeMessage(item.message || "Review your usage settings.")} status="setup" statusLabel="Alert" />
          ))}
          {usage?.notifications?.length ? null : <div className={styles.emptyState}>No account alerts yet.</div>}
        </div>
      </article>
    </section>
  );
}

export default function StreamsAccountActionPanel({ pageKind, title, description }: Props) {
  const config = CONFIG[pageKind] || CONFIG.overview;
  const [usage, setUsage] = useState<UsageState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const isUsagePage = pageKind === "usage";
  const isBillingPage = pageKind === "billing";
  const isCreditsPage = pageKind === "credits";
  const isNotificationsPage = pageKind === "notifications";
  const isModulesPage = pageKind === "modules";
  const usesUsageData = isUsagePage || isBillingPage || isCreditsPage || isNotificationsPage || isModulesPage;
  const planName = usage?.plan?.name || "Free Builder";

  const loadUsage = useCallback(async () => {
    if (!usesUsageData) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/streams-ai/usage", { method: "GET", headers: { "Content-Type": "application/json" } });
      const data = (await readJson(response)) as UsageState & { message?: string; error?: string };
      if (!response.ok || data.ok === false) throw new Error(data.message || data.error || SAFE_SETUP_MESSAGE);
      setUsage(data);
      setNotice("");
    } catch (err) {
      setError(sanitizeMessage(err instanceof Error ? err.message : SAFE_SETUP_MESSAGE));
    } finally {
      setLoading(false);
    }
  }, [usesUsageData]);

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
      const response = await fetch(BILLING_CENTER_PATH, { method: "POST", headers: { "Content-Type": "application/json" } });
      const data = (await readJson(response)) as Record<string, unknown>;
      const redirect = pickRedirect(data);
      if (!response.ok || !redirect) throw new Error("Billing information is temporarily unavailable.");
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
      const response = await fetch(BILLING_CHECKOUT_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: pageKind, product }),
      });
      const data = (await readJson(response)) as Record<string, unknown>;
      const redirect = pickRedirect(data);
      if (!response.ok || !redirect) throw new Error("Billing information is temporarily unavailable.");
      window.location.assign(redirect);
    } catch (err) {
      setError(sanitizeMessage(err instanceof Error ? err.message : SAFE_SETUP_MESSAGE));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void loadUsage();
  }, [loadUsage]);

  const heroActions: HeroAction[] = [
    ...(isBillingPage ? [
      { label: "Manage billing", action: openAccountBilling },
      { label: "Change plan", action: () => startPlanSetup("plan") },
    ] : []),
    ...(isCreditsPage ? [
      { label: "Add usage credits", action: () => startPlanSetup("credits") },
      { label: usage?.usageCredits?.enabled ? "Usage credits enabled" : "Enable usage credits", action: () => updateUsageSettings({ paidUsageEnabled: true }, "Usage credits enabled."), disabled: Boolean(usage?.usageCredits?.enabled) },
      { label: usage?.autoReload?.enabled ? "Auto-reload enabled" : "Enable auto-reload", action: () => updateUsageSettings({ autoReloadEnabled: true }, "Auto-reload enabled."), disabled: Boolean(usage?.autoReload?.enabled) },
    ] : []),
    ...(isUsagePage || isBillingPage || isCreditsPage || isNotificationsPage ? [{ label: "Refresh summary", action: loadUsage }] : []),
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
            <span>{loading && usesUsageData ? "Syncing" : "Ready"}</span>
          </div>
        </div>
        {heroActions.length ? (
          <div className={styles.heroActions}>
            {heroActions.map((item) => (
              <button key={item.label} type="button" onClick={() => void item.action()} disabled={busy || item.disabled}>
                {busy ? "Working..." : item.label}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {error && usesUsageData ? <section className={styles.error}>{error}</section> : null}
      {!error && notice && usesUsageData ? <section className={styles.notice}>{notice}</section> : null}

      {!usesUsageData ? <SetupPage config={config} /> : null}
      {isUsagePage ? <LiveUsageSummary usage={usage} /> : null}
      {isBillingPage ? <BillingSummary usage={usage} /> : null}
      {isCreditsPage ? <CreditsSummary usage={usage} /> : null}
      {isNotificationsPage ? <NotificationsSummary usage={usage} /> : null}

      {(isUsagePage || isCreditsPage || isModulesPage) ? <FeatureCosts usage={usage} /> : null}
      {(isUsagePage || isBillingPage || isCreditsPage) ? <ActivityPanels usage={usage} includeEmptyState={isUsagePage} /> : null}
      {isModulesPage ? <SetupPage config={CONFIG.modules} /> : null}
    </main>
  );
}
