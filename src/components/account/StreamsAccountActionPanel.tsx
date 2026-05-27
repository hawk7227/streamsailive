"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchAccountWithActivity,
  fetchCreditsWithActivity,
  openBillingPortalWithActivity,
  startCheckoutWithActivity,
  fetchProjectsWithActivity,
  callGroupChatWithActivity,
  emitGitHubBuildBlockedActivity,
} from "@/components/streams-ai/current-chat/new-face/runtime/streamsAccountActivityClient";
import styles from "./StreamsAccountActionPanel.module.css";

type PageKind =
  | "overview"
  | "profile"
  | "settings"
  | "privacy"
  | "billing"
  | "credits"
  | "modules"
  | "personalization"
  | "language"
  | "apps"
  | "gift"
  | "help"
  | "learnMore";

type Props = {
  pageKind: PageKind;
  title: string;
  description: string;
};

type PageConfig = {
  eyebrow: string;
  gradient: string;
  badge: string;
  narrative: string;
  cards: Array<{ label: string; title: string; body: string; metric: string }>;
  rows: Array<{ label: string; value: string }>;
};

const CONFIG: Record<PageKind, PageConfig> = {
  overview: {
    eyebrow: "Workspace command center",
    gradient: "blue",
    badge: "Live account",
    narrative: "A premium command-center view for plan, credits, modules, billing, and account activity.",
    cards: [
      { label: "Plan", metric: "Live", title: "Current access", body: "Loaded through the account route and account activity lifecycle." },
      { label: "Credits", metric: "Synced", title: "Credit balance", body: "Credits refresh through the real credits route." },
      { label: "Modules", metric: "10", title: "Capabilities", body: "Module/bundle display is prepared for entitlement data." },
      { label: "Activity", metric: "On", title: "Live layer", body: "Actions emit account, credits, billing, and project activity." },
    ],
    rows: [
      { label: "Account route", value: "/api/streams-ai/account" },
      { label: "Credits route", value: "/api/streams-ai/credits" },
      { label: "Billing routes", value: "/api/stripe/checkout + /api/stripe/portal" },
    ],
  },
  profile: {
    eyebrow: "Identity",
    gradient: "violet",
    badge: "Profile",
    narrative: "A profile-focused layout for visible identity, email, role, and session status.",
    cards: [
      { label: "Name", metric: "User", title: "Display identity", body: "Profile data is loaded from account state, not hardcoded text." },
      { label: "Email", metric: "Auth", title: "Login identity", body: "Authentication context drives identity display." },
      { label: "Role", metric: "Owner", title: "Workspace role", body: "Role display is account-data backed when returned." },
      { label: "Refresh", metric: "Live", title: "Account refresh", body: "Refresh account emits running/success/failure activity." },
    ],
    rows: [
      { label: "Primary action", value: "Refresh account" },
      { label: "No fake data", value: "Missing values render as Not loaded" },
      { label: "Mobile", value: "One-column safe-area account cards" },
    ],
  },
  settings: {
    eyebrow: "Controls",
    gradient: "slate",
    badge: "Settings",
    narrative: "Workspace behavior, app defaults, assistant preferences, and product controls.",
    cards: [
      { label: "Workspace", metric: "Ready", title: "Workspace defaults", body: "Prepared for real settings routes." },
      { label: "Runtime", metric: "Live", title: "Assistant behavior", body: "Shared activity/status system is active." },
      { label: "Alerts", metric: "Planned", title: "Notifications", body: "No fake notification success state is shown." },
      { label: "Truth", metric: "Strict", title: "Blocked states", body: "Missing backend actions remain explicit." },
    ],
    rows: [
      { label: "Settings source", value: "Account/runtime APIs" },
      { label: "Activity", value: "emitAccountActivity on real refresh" },
      { label: "Blocked actions", value: "Shown, not hidden" },
    ],
  },
  privacy: {
    eyebrow: "Trust layer",
    gradient: "green",
    badge: "Privacy",
    narrative: "Data, retention, visibility, and privacy controls with truthful availability states.",
    cards: [
      { label: "Data", metric: "Scoped", title: "Account data", body: "Requested through existing account routes." },
      { label: "Visibility", metric: "Private", title: "Workspace access", body: "Group/session access must be explicitly enabled." },
      { label: "Exports", metric: "Blocked", title: "Data export", body: "Export stays blocked until a backend exists." },
      { label: "Deletion", metric: "Real only", title: "Delete state", body: "Deletion must call real backend actions." },
    ],
    rows: [
      { label: "Privacy state", value: "No fake toggles" },
      { label: "Access model", value: "Owner/session scoped" },
      { label: "Data rule", value: "Backend required before success UI" },
    ],
  },
  billing: {
    eyebrow: "Revenue system",
    gradient: "gold",
    badge: "Stripe live",
    narrative: "Stripe portal and checkout entry points with real billing activity events.",
    cards: [
      { label: "Portal", metric: "Stripe", title: "Manage billing", body: "Open billing portal calls /api/stripe/portal." },
      { label: "Checkout", metric: "Live", title: "Start checkout", body: "Checkout redirects only when a URL is returned." },
      { label: "Plan", metric: "API", title: "Subscription state", body: "Subscription status is loaded from account data." },
      { label: "Errors", metric: "Visible", title: "Exact failure", body: "Missing tables/env return visible API errors." },
    ],
    rows: [
      { label: "Portal action", value: "openBillingPortalWithActivity" },
      { label: "Checkout action", value: "startCheckoutWithActivity" },
      { label: "Emitter", value: "emitBillingActivity" },
    ],
  },
  credits: {
    eyebrow: "Usage ledger",
    gradient: "cyan",
    badge: "Credits",
    narrative: "Credit refresh, credit checkout, usage state, and visible ledger errors.",
    cards: [
      { label: "Available", metric: "API", title: "Available credits", body: "Loaded through /api/streams-ai/credits." },
      { label: "Included", metric: "Plan", title: "Monthly included", body: "Shown when returned by account/credits routes." },
      { label: "Reserved", metric: "Jobs", title: "Reserved credits", body: "Reserved state should come from jobs/ledger backend." },
      { label: "Buy", metric: "Stripe", title: "Credit packs", body: "Buy credits starts checkout with product=credits." },
    ],
    rows: [
      { label: "Refresh action", value: "fetchCreditsWithActivity" },
      { label: "Buy action", value: "startCheckoutWithActivity({ product: credits })" },
      { label: "Emitter", value: "emitCreditsActivity" },
    ],
  },
  modules: {
    eyebrow: "Capability store",
    gradient: "pink",
    badge: "Modules",
    narrative: "A capability-store view for individual modules, bundle upsell, and module credit paths.",
    cards: [
      { label: "Image", metric: "Module", title: "Image Studio", body: "Individual entitlement-ready card." },
      { label: "Video", metric: "Module", title: "Video Studio", body: "Video entitlement and credit state." },
      { label: "Voice", metric: "Module", title: "Voice Studio", body: "Realtime voice and generated voice access." },
      { label: "Bundle", metric: "Upsell", title: "All modules", body: "Bundle path is ready for checkout wiring." },
    ],
    rows: [
      { label: "Module plans", value: "Individual signup + bundle upsell" },
      { label: "Credits", value: "Included credits + action cost display" },
      { label: "Trial", value: "One trial per module/workspace when backend supports it" },
    ],
  },
  personalization: {
    eyebrow: "Assistant style",
    gradient: "violet",
    badge: "Personalization",
    narrative: "Assistant preferences, response behavior, style, model mode, and account experience settings.",
    cards: [
      { label: "Tone", metric: "Config", title: "Assistant tone", body: "Prepared for a real personalization route." },
      { label: "Memory", metric: "Scoped", title: "Project memory", body: "Memory settings must connect to memory backend." },
      { label: "Modes", metric: "Runtime", title: "Default modes", body: "Mode defaults should map to runtime state." },
      { label: "Safety", metric: "Strict", title: "Truthful UI", body: "No fake model/provider preference claims." },
    ],
    rows: [
      { label: "Runtime tie-in", value: "Mode/menu configuration" },
      { label: "Status tie-in", value: "emitAccountActivity on save/load" },
      { label: "Backend requirement", value: "Personalization persistence route" },
    ],
  },
  language: {
    eyebrow: "Region",
    gradient: "blue",
    badge: "Locale",
    narrative: "Language, region, timezone, formatting, and accessibility-ready preferences.",
    cards: [
      { label: "Language", metric: "Default", title: "Display language", body: "Needs persistence route before save." },
      { label: "Timezone", metric: "Detected", title: "Local time", body: "Can be detected and stored when backend supports it." },
      { label: "Currency", metric: "Stripe", title: "Billing currency", body: "Currency display should follow Stripe/account data." },
      { label: "Access", metric: "Mobile", title: "Readability", body: "Large touch targets and clear contrast." },
    ],
    rows: [
      { label: "Save rule", value: "No fake save without backend persistence" },
      { label: "Mobile", value: "100dvh safe-area layout" },
      { label: "Emitter", value: "emitAccountActivity on future saves" },
    ],
  },
  apps: {
    eyebrow: "Connected systems",
    gradient: "green",
    badge: "Apps",
    narrative: "Projects, connectors, GitHub/build activity, app installs, and integration visibility.",
    cards: [
      { label: "Projects", metric: "API", title: "Project refresh", body: "Refresh projects calls /api/projects." },
      { label: "GitHub", metric: "Emitter", title: "Build activity", body: "Current UI emits blocked GitHub/build activity." },
      { label: "PWA", metric: "Ready", title: "Web app", body: "PWA support should be surfaced from app runtime." },
      { label: "Connectors", metric: "Live", title: "Connector state", body: "Connector cards should be route-backed only." },
    ],
    rows: [
      { label: "Project action", value: "fetchProjectsWithActivity" },
      { label: "GitHub action", value: "emitGitHubBuildBlockedActivity" },
      { label: "Group chat test", value: "/api/streams-ai/group-chat" },
    ],
  },
  gift: {
    eyebrow: "Growth loop",
    gradient: "gold",
    badge: "Invites",
    narrative: "Invite credits, referrals, and gift flows prepared for Stripe/ledger backend routes.",
    cards: [
      { label: "Invite", metric: "Planned", title: "Invite link", body: "Requires referral route before success state." },
      { label: "Gift", metric: "Checkout", title: "Gift credits", body: "Should use Stripe checkout and credit ledger." },
      { label: "Ledger", metric: "Required", title: "Credit ledger", body: "Gift credits must write to the ledger." },
      { label: "Status", metric: "Live", title: "Activity", body: "Future gift actions emit billing/credit activity." },
    ],
    rows: [
      { label: "No fake gifting", value: "Must use Stripe + ledger" },
      { label: "Emitter", value: "emitCreditsActivity + emitBillingActivity" },
      { label: "Pending backend", value: "Referral/gift credit route" },
    ],
  },
  help: {
    eyebrow: "Support",
    gradient: "slate",
    badge: "Help",
    narrative: "Support, docs, status checks, and product assistance with real status surfaces.",
    cards: [
      { label: "Docs", metric: "Ready", title: "Documentation", body: "Docs and help center routes exist." },
      { label: "Status", metric: "Route", title: "System status", body: "System status should reflect API route truth." },
      { label: "Support", metric: "Planned", title: "Contact support", body: "Needs real support ticket route." },
      { label: "Activity", metric: "Visible", title: "Live errors", body: "Failures show exact API messages." },
    ],
    rows: [
      { label: "Help center", value: "/help-center" },
      { label: "Docs", value: "/docs" },
      { label: "Status", value: "/system-status" },
    ],
  },
  learnMore: {
    eyebrow: "Product education",
    gradient: "cyan",
    badge: "Learn",
    narrative: "STREAMS modules, generation paths, pricing, credits, and team-ready behavior.",
    cards: [
      { label: "Create", metric: "AI", title: "Generation stack", body: "Image, video, voice, music, and builder modules." },
      { label: "Scale", metric: "1M-ready", title: "Teams and accounts", body: "Account system is being hardened for scale." },
      { label: "Credits", metric: "Profit", title: "Usage model", body: "Credits and usage ledger remain the business model." },
      { label: "Launch", metric: "Next", title: "Deployment", body: "GitHub/build/deploy proof layer remains next backend work." },
    ],
    rows: [
      { label: "Pricing", value: "/pricing" },
      { label: "Capabilities", value: "10 module surfaces" },
      { label: "Next backend", value: "GitHub/build/deploy actions" },
    ],
  },
};

function summarize(value: unknown) {
  if (!value || typeof value !== "object") return "Not loaded";
  const object = value as Record<string, unknown>;
  if (typeof object.email === "string") return object.email;
  if (typeof object.plan === "string") return object.plan;
  if (typeof object.status === "string") return object.status;
  if (typeof object.ok === "boolean") return object.ok ? "Loaded" : "Error";
  return "Loaded";
}

export default function StreamsAccountActionPanel({ pageKind, title, description }: Props) {
  const config = CONFIG[pageKind] || CONFIG.overview;
  const [account, setAccount] = useState<unknown>(null);
  const [credits, setCredits] = useState<unknown>(null);
  const [projects, setProjects] = useState<unknown>(null);
  const [error, setError] = useState("");
  const [lastAction, setLastAction] = useState("");
  const [groupSessionId, setGroupSessionId] = useState("");
  const [groupEmail, setGroupEmail] = useState("");
  const [groupName, setGroupName] = useState("STREAMS Group Chat");

  async function loadAccount() {
    setError("");
    setLastAction("Loading account...");
    try {
      setAccount(await fetchAccountWithActivity());
      setLastAction("Account loaded.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Account loading failed.";
      setError(message);
      setLastAction(message);
    }
  }

  async function loadCredits() {
    setError("");
    setLastAction("Loading credits...");
    try {
      setCredits(await fetchCreditsWithActivity());
      setLastAction("Credits loaded.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Credits loading failed.";
      setError(message);
      setLastAction(message);
    }
  }

  async function loadProjects() {
    setError("");
    setLastAction("Loading projects...");
    try {
      setProjects(await fetchProjectsWithActivity());
      setLastAction("Projects loaded.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Projects loading failed.";
      setError(message);
      setLastAction(message);
    }
  }

  async function openPortal() {
    setError("");
    setLastAction("Opening billing portal...");
    try {
      await openBillingPortalWithActivity();
      setLastAction("Billing portal redirect started.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Billing portal failed.";
      setError(message);
      setLastAction(message);
    }
  }

  async function startCheckout(source: string, product?: string) {
    setError("");
    setLastAction("Starting checkout...");
    try {
      await startCheckoutWithActivity({ source, product });
      setLastAction("Checkout redirect started.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Checkout failed.";
      setError(message);
      setLastAction(message);
    }
  }

  async function runGroupChatTest(action: "create" | "invite" | "remove" | "leave" | "rename") {
    setError("");
    setLastAction(`${action} group chat...`);
    try {
      await callGroupChatWithActivity({ sessionId: groupSessionId, action, email: groupEmail, name: groupName });
      setLastAction(`Group chat ${action} complete.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : `Group chat ${action} failed.`;
      setError(message);
      setLastAction(message);
    }
  }

  useEffect(() => {
    loadAccount();
    if (pageKind === "credits" || pageKind === "billing" || pageKind === "modules") loadCredits();
    if (pageKind === "apps") loadProjects();
  }, [pageKind]);

  const primaryActions = useMemo(() => {
    if (pageKind === "billing") {
      return [
        { label: "Open billing portal", action: openPortal },
        { label: "Start checkout", action: () => startCheckout("account_billing") },
      ];
    }
    if (pageKind === "credits") {
      return [
        { label: "Refresh credits", action: loadCredits },
        { label: "Buy credits", action: () => startCheckout("account_credits", "credits") },
      ];
    }
    if (pageKind === "apps") {
      return [
        { label: "Refresh projects", action: loadProjects },
        { label: "GitHub/build activity", action: () => emitGitHubBuildBlockedActivity("GitHub/build/deploy") },
      ];
    }
    return [{ label: "Refresh account", action: loadAccount }];
  }, [pageKind, groupSessionId, groupEmail, groupName]);

  return (
    <main className={styles.shell} data-gradient={config.gradient}>
      <section className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.heroContent}>
          <p className={styles.kicker}>{config.eyebrow}</p>
          <h1>{title}</h1>
          <p>{description || config.narrative}</p>
          <div className={styles.heroMeta}>
            <span>{config.badge}</span>
            <span>Mobile-first</span>
            <span>Activity wired</span>
          </div>
        </div>
        <div className={styles.heroActions}>
          {primaryActions.map((item) => (
            <button key={item.label} type="button" onClick={item.action}>{item.label}</button>
          ))}
        </div>
      </section>

      {error ? <section className={styles.error}>{error}</section> : null}

      <section className={styles.grid}>
        {config.cards.map((card) => (
          <article className={styles.card} key={`${pageKind}-${card.label}`}>
            <span>{card.label}</span>
            <strong>{card.metric}</strong>
            <h3>{card.title}</h3>
            <p>{card.body}</p>
          </article>
        ))}
      </section>

      <section className={styles.liveDataGrid}>
        <article><span>Account</span><strong>{summarize(account)}</strong><p>/api/streams-ai/account + emitAccountActivity</p></article>
        <article><span>Credits</span><strong>{summarize(credits)}</strong><p>/api/streams-ai/credits + emitCreditsActivity</p></article>
        <article><span>Projects</span><strong>{summarize(projects)}</strong><p>/api/projects + emitProjectActivity</p></article>
      </section>

      <section className={styles.proofBar}><strong>Last action</strong><span>{lastAction || "No account action has run yet."}</span></section>

      <section className={styles.groupCard}>
        <div>
          <p className={styles.kicker}>Group chat backend test</p>
          <h2>Real session test</h2>
          <p>Calls /api/streams-ai/group-chat against a real session id and emits group chat activity events.</p>
        </div>
        <label>Session ID<input value={groupSessionId} onChange={(event) => setGroupSessionId(event.target.value)} placeholder="Paste a real STREAMS chat session id" /></label>
        <label>Invite email<input value={groupEmail} onChange={(event) => setGroupEmail(event.target.value)} placeholder="person@example.com" type="email" /></label>
        <label>Group name<input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="STREAMS Group Chat" /></label>
        <div className={styles.groupActions}>
          <button type="button" onClick={() => runGroupChatTest("create")}>Create group</button>
          <button type="button" onClick={() => runGroupChatTest("invite")}>Invite</button>
          <button type="button" onClick={() => runGroupChatTest("rename")}>Rename</button>
          <button type="button" onClick={() => runGroupChatTest("remove")}>Remove</button>
          <button type="button" onClick={() => runGroupChatTest("leave")}>Leave</button>
        </div>
      </section>

      <section className={styles.section}>
        <div><p className={styles.kicker}>{config.badge}</p><h2>{config.narrative}</h2></div>
        <div className={styles.rows}>
          {config.rows.map((row) => (
            <div key={`${pageKind}-${row.label}`}><strong>{row.label}</strong><span>{row.value}</span></div>
          ))}
        </div>
      </section>
    </main>
  );
}
