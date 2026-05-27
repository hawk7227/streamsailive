from pathlib import Path

ROOT = Path.cwd()

def write(path, text):
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")

# --------------------------------------------------------------------
# 1. Real group-chat backend persisted on streams_chat_sessions.metadata
# --------------------------------------------------------------------
write("src/app/api/streams-ai/group-chat/route.ts", '''import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type GroupAction = "create" | "invite" | "remove" | "leave" | "rename";

type Body = {
  sessionId?: string;
  action?: GroupAction;
  email?: string;
  name?: string;
};

function nowIso() {
  return new Date().toISOString();
}

function cleanEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function isAction(value: unknown): value is GroupAction {
  return (
    value === "create" ||
    value === "invite" ||
    value === "remove" ||
    value === "leave" ||
    value === "rename"
  );
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized: sign in before changing group chat." },
      { status: 401 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const sessionId = String(body.sessionId || "").trim();
  const action = body.action;

  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "sessionId is required" }, { status: 400 });
  }

  if (!isAction(action)) {
    return NextResponse.json(
      { ok: false, error: "action must be create, invite, remove, leave, or rename" },
      { status: 400 }
    );
  }

  const { data: existing, error: lookupError } = await supabase
    .from("streams_chat_sessions")
    .select("id,user_id,title,metadata")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json(
      { ok: false, error: "Session lookup failed.", details: lookupError.message },
      { status: 500 }
    );
  }

  if (!existing) {
    return NextResponse.json({ ok: false, error: "Session not found for this user." }, { status: 404 });
  }

  const metadata =
    existing.metadata && typeof existing.metadata === "object"
      ? { ...existing.metadata }
      : {};

  const groupChat =
    metadata.group_chat && typeof metadata.group_chat === "object"
      ? { ...metadata.group_chat }
      : {
          enabled: false,
          name: existing.title || "Group chat",
          owner_user_id: user.id,
          participants: [],
          invitations: [],
          events: [],
        };

  const participants = Array.isArray(groupChat.participants) ? [...groupChat.participants] : [];
  const invitations = Array.isArray(groupChat.invitations) ? [...groupChat.invitations] : [];
  const events = Array.isArray(groupChat.events) ? [...groupChat.events] : [];

  const pushEvent = (event: Record<string, unknown>) => {
    events.unshift({
      ...event,
      at: nowIso(),
      actor_user_id: user.id,
    });
    groupChat.events = events.slice(0, 50);
  };

  if (action === "create") {
    groupChat.enabled = true;
    groupChat.owner_user_id = groupChat.owner_user_id || user.id;
    groupChat.name = String(body.name || groupChat.name || existing.title || "Group chat");
    groupChat.created_at = groupChat.created_at || nowIso();

    if (!participants.some((participant: any) => participant.user_id === user.id)) {
      participants.push({
        user_id: user.id,
        email: user.email || "",
        role: "owner",
        status: "active",
        joined_at: nowIso(),
      });
    }

    groupChat.participants = participants;
    pushEvent({ type: "group_created" });
  }

  if (action === "rename") {
    const name = String(body.name || "").trim();
    if (!name) {
      return NextResponse.json({ ok: false, error: "name is required" }, { status: 400 });
    }

    groupChat.enabled = true;
    groupChat.name = name;
    groupChat.renamed_at = nowIso();
    pushEvent({ type: "group_renamed", name });
  }

  if (action === "invite") {
    const email = cleanEmail(body.email);

    if (!email || !email.includes("@")) {
      return NextResponse.json({ ok: false, error: "valid email is required" }, { status: 400 });
    }

    groupChat.enabled = true;

    const existingInvite = invitations.find((invite: any) => cleanEmail(invite.email) === email);
    if (!existingInvite) {
      invitations.push({
        email,
        status: "pending",
        invited_by_user_id: user.id,
        invited_at: nowIso(),
      });
    }

    groupChat.invitations = invitations;
    pushEvent({ type: "participant_invited", email });
  }

  if (action === "remove") {
    const email = cleanEmail(body.email);

    if (!email || !email.includes("@")) {
      return NextResponse.json({ ok: false, error: "valid email is required" }, { status: 400 });
    }

    groupChat.participants = participants.filter((participant: any) => cleanEmail(participant.email) !== email);
    groupChat.invitations = invitations.map((invite: any) =>
      cleanEmail(invite.email) === email
        ? { ...invite, status: "removed", removed_at: nowIso(), removed_by_user_id: user.id }
        : invite
    );

    pushEvent({ type: "participant_removed", email });
  }

  if (action === "leave") {
    groupChat.participants = participants.map((participant: any) =>
      participant.user_id === user.id || cleanEmail(participant.email) === cleanEmail(user.email)
        ? { ...participant, status: "left", left_at: nowIso() }
        : participant
    );

    pushEvent({ type: "participant_left", email: user.email || "" });
  }

  groupChat.participants = groupChat.participants || participants;
  groupChat.invitations = groupChat.invitations || invitations;
  groupChat.updated_at = nowIso();

  metadata.group_chat = groupChat;
  metadata.updated_at = nowIso();

  const { data: updated, error: updateError } = await supabase
    .from("streams_chat_sessions")
    .update({ metadata, updated_at: nowIso() })
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .select("id,title,metadata,updated_at,created_at")
    .maybeSingle();

  if (updateError) {
    return NextResponse.json(
      { ok: false, error: "Group chat update failed.", details: updateError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    action,
    groupChat,
    session: updated,
  });
}
''')

# --------------------------------------------------------------------
# 2. Client helpers that emit account/billing/credits/project/github/group activity
# --------------------------------------------------------------------
write("src/components/streams-ai/current-chat/new-face/runtime/streamsAccountActivityClient.js", '''import {
  emitAccountActivity,
  emitBillingActivity,
  emitCreditsActivity,
  emitGitHubActivity,
  emitProjectActivity,
  emitGroupChatActivity,
} from "./streamsGlobalActivityBridge";
import { STREAMS_ACTIVITY_PHASES } from "./streamsActivityEvents";

async function readJson(response) {
  return response.json().catch(() => ({}));
}

export async function fetchAccountWithActivity() {
  emitAccountActivity(STREAMS_ACTIVITY_PHASES.RUNNING, "Loading account...");
  const response = await fetch("/api/streams-ai/account", { method: "GET" });
  const data = await readJson(response);

  if (!response.ok || data?.ok === false) {
    const reason = data?.error || "Account loading failed.";
    emitAccountActivity(STREAMS_ACTIVITY_PHASES.FAILED, reason);
    throw new Error(reason);
  }

  emitAccountActivity(STREAMS_ACTIVITY_PHASES.COMPLETE, "Account loaded");
  return data;
}

export async function fetchCreditsWithActivity() {
  emitCreditsActivity(STREAMS_ACTIVITY_PHASES.RUNNING, "Loading credits...");
  const response = await fetch("/api/streams-ai/credits", { method: "GET" });
  const data = await readJson(response);

  if (!response.ok || data?.ok === false) {
    const reason = data?.error || "Credits loading failed.";
    emitCreditsActivity(STREAMS_ACTIVITY_PHASES.FAILED, reason);
    throw new Error(reason);
  }

  emitCreditsActivity(STREAMS_ACTIVITY_PHASES.COMPLETE, "Credits loaded");
  return data;
}

export async function openBillingPortalWithActivity() {
  emitBillingActivity(STREAMS_ACTIVITY_PHASES.RUNNING, "Opening billing portal...");
  const response = await fetch("/api/stripe/portal", { method: "POST" });
  const data = await readJson(response);

  if (!response.ok || data?.ok === false) {
    const reason = data?.error || data?.details || "Billing portal failed.";
    emitBillingActivity(STREAMS_ACTIVITY_PHASES.FAILED, reason);
    throw new Error(reason);
  }

  const url = data.url || data.portalUrl;
  if (!url) {
    const reason = "Billing portal did not return a redirect URL.";
    emitBillingActivity(STREAMS_ACTIVITY_PHASES.FAILED, reason);
    throw new Error(reason);
  }

  emitBillingActivity(STREAMS_ACTIVITY_PHASES.COMPLETE, "Billing portal ready");
  window.location.assign(url);
  return data;
}

export async function startCheckoutWithActivity(payload = {}) {
  emitBillingActivity(STREAMS_ACTIVITY_PHASES.RUNNING, "Starting checkout...");
  const response = await fetch("/api/stripe/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await readJson(response);

  if (!response.ok || data?.ok === false) {
    const reason = data?.error || data?.details || "Checkout failed.";
    emitBillingActivity(STREAMS_ACTIVITY_PHASES.FAILED, reason);
    throw new Error(reason);
  }

  const url = data.url || data.checkoutUrl;
  if (!url) {
    const reason = "Checkout did not return a redirect URL.";
    emitBillingActivity(STREAMS_ACTIVITY_PHASES.FAILED, reason);
    throw new Error(reason);
  }

  emitBillingActivity(STREAMS_ACTIVITY_PHASES.COMPLETE, "Checkout ready");
  window.location.assign(url);
  return data;
}

export async function fetchProjectsWithActivity() {
  emitProjectActivity(STREAMS_ACTIVITY_PHASES.RUNNING, "Loading projects...");
  const response = await fetch("/api/projects", { method: "GET" });
  const data = await readJson(response);

  if (!response.ok || data?.ok === false) {
    const reason = data?.error || "Projects loading failed.";
    emitProjectActivity(STREAMS_ACTIVITY_PHASES.FAILED, reason);
    throw new Error(reason);
  }

  emitProjectActivity(STREAMS_ACTIVITY_PHASES.COMPLETE, "Projects loaded");
  return data;
}

export async function callGroupChatWithActivity({ sessionId, action, email, name }) {
  emitGroupChatActivity(STREAMS_ACTIVITY_PHASES.RUNNING, `${action} group chat...`, { sessionId, email, name });
  const response = await fetch("/api/streams-ai/group-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, action, email, name }),
  });
  const data = await readJson(response);

  if (!response.ok || data?.ok === false) {
    const reason = data?.error || data?.details || "Group chat action failed.";
    emitGroupChatActivity(STREAMS_ACTIVITY_PHASES.FAILED, reason, { sessionId, email, name });
    throw new Error(reason);
  }

  emitGroupChatActivity(STREAMS_ACTIVITY_PHASES.COMPLETE, "Group chat updated", { sessionId, email, name });
  return data;
}

export function emitGitHubBuildBlockedActivity(label = "GitHub build/deploy action") {
  emitGitHubActivity(
    STREAMS_ACTIVITY_PHASES.BLOCKED,
    `Blocked: real ${label} backend/action is not wired to this UI yet.`,
    { tool: label }
  );
}
''')

# --------------------------------------------------------------------
# 3. Account action panel + mobile-first redesign shell
# --------------------------------------------------------------------
write("src/components/account/StreamsAccountActionPanel.tsx", '''"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchAccountWithActivity,
  fetchCreditsWithActivity,
  openBillingPortalWithActivity,
  startCheckoutWithActivity,
  fetchProjectsWithActivity,
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

function summarize(value: unknown) {
  if (!value || typeof value !== "object") return "Not loaded";
  const object = value as Record<string, unknown>;
  if (typeof object.email === "string") return object.email;
  if (typeof object.plan === "string") return object.plan;
  if (typeof object.status === "string") return object.status;
  return "Loaded";
}

export default function StreamsAccountActionPanel({ pageKind, title, description }: Props) {
  const [account, setAccount] = useState<unknown>(null);
  const [credits, setCredits] = useState<unknown>(null);
  const [projects, setProjects] = useState<unknown>(null);
  const [error, setError] = useState("");

  async function loadAccount() {
    setError("");
    try {
      setAccount(await fetchAccountWithActivity());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Account loading failed.");
    }
  }

  async function loadCredits() {
    setError("");
    try {
      setCredits(await fetchCreditsWithActivity());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Credits loading failed.");
    }
  }

  async function loadProjects() {
    setError("");
    try {
      setProjects(await fetchProjectsWithActivity());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Projects loading failed.");
    }
  }

  useEffect(() => {
    loadAccount();
    if (pageKind === "credits" || pageKind === "billing" || pageKind === "modules") {
      loadCredits();
    }
    if (pageKind === "apps") {
      loadProjects();
    }
  }, [pageKind]);

  const primaryActions = useMemo(() => {
    if (pageKind === "billing") {
      return [
        { label: "Open billing portal", action: () => openBillingPortalWithActivity().catch((err) => setError(err.message)) },
        { label: "Start checkout", action: () => startCheckoutWithActivity({ source: "account_billing" }).catch((err) => setError(err.message)) },
      ];
    }

    if (pageKind === "credits") {
      return [
        { label: "Refresh credits", action: loadCredits },
        { label: "Buy credits", action: () => startCheckoutWithActivity({ source: "account_credits", product: "credits" }).catch((err) => setError(err.message)) },
      ];
    }

    if (pageKind === "apps") {
      return [
        { label: "Refresh projects", action: loadProjects },
        { label: "GitHub/build activity", action: () => emitGitHubBuildBlockedActivity("GitHub/build/deploy") },
      ];
    }

    return [
      { label: "Refresh account", action: loadAccount },
    ];
  }, [pageKind]);

  return (
    <main className={styles.shell}>
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>STREAMS Account</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className={styles.heroActions}>
          {primaryActions.map((item) => (
            <button key={item.label} type="button" onClick={item.action}>
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {error ? <section className={styles.error}>{error}</section> : null}

      <section className={styles.grid}>
        <article className={styles.card}>
          <span>Account</span>
          <strong>{summarize(account)}</strong>
          <p>Loaded through /api/streams-ai/account with emitAccountActivity lifecycle.</p>
        </article>

        <article className={styles.card}>
          <span>Credits</span>
          <strong>{summarize(credits)}</strong>
          <p>Loaded through /api/streams-ai/credits with emitCreditsActivity lifecycle.</p>
        </article>

        <article className={styles.card}>
          <span>Billing</span>
          <strong>{pageKind === "billing" ? "Actions available" : "Portal ready"}</strong>
          <p>Billing buttons call Stripe routes and emit billing activity events.</p>
        </article>

        <article className={styles.card}>
          <span>Projects / Apps</span>
          <strong>{summarize(projects)}</strong>
          <p>Project loading uses emitProjectActivity. GitHub/build emitters are present for real backend slices.</p>
        </article>
      </section>

      <section className={styles.section}>
        <h2>{title} actions</h2>
        <div className={styles.rows}>
          <div>
            <strong>Loading state</strong>
            <span>Real API calls emit running activity before fetch starts.</span>
          </div>
          <div>
            <strong>Success state</strong>
            <span>Complete activity emits only after the API returns successfully.</span>
          </div>
          <div>
            <strong>Failure state</strong>
            <span>Failure activity emits with the exact API error message.</span>
          </div>
        </div>
      </section>
    </main>
  );
}
''')

write("src/components/account/StreamsAccountActionPanel.module.css", '''.shell {
  min-height: 100dvh;
  padding: max(20px, env(safe-area-inset-top)) 16px max(28px, env(safe-area-inset-bottom));
  background: #f7f7f8;
  color: #111;
}

.hero {
  max-width: 1120px;
  margin: 0 auto 18px;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 16px;
  align-items: end;
  border: 1px solid rgba(0,0,0,.08);
  border-radius: 28px;
  background: #fff;
  box-shadow: 0 18px 60px rgba(0,0,0,.08);
  padding: 24px;
}

.kicker {
  margin: 0 0 8px;
  color: #6b7280;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.hero h1 {
  margin: 0;
  font-size: clamp(28px, 5vw, 48px);
  letter-spacing: -.05em;
}

.hero p {
  max-width: 720px;
  color: #555;
  line-height: 1.5;
}

.heroActions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.heroActions button {
  min-height: 44px;
  border: 0;
  border-radius: 999px;
  background: #111;
  color: #fff;
  padding: 0 16px;
  font-weight: 800;
  cursor: pointer;
}

.error {
  max-width: 1120px;
  margin: 0 auto 14px;
  border: 1px solid rgba(220,38,38,.2);
  border-radius: 18px;
  background: #fff1f1;
  color: #991b1b;
  padding: 14px 16px;
}

.grid {
  max-width: 1120px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.card {
  border: 1px solid rgba(0,0,0,.08);
  border-radius: 24px;
  background: #fff;
  padding: 18px;
  min-height: 170px;
  box-shadow: 0 10px 32px rgba(0,0,0,.05);
}

.card span {
  color: #6b7280;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
}

.card strong {
  display: block;
  margin-top: 10px;
  font-size: 24px;
  letter-spacing: -.03em;
}

.card p {
  color: #555;
  line-height: 1.45;
}

.section {
  max-width: 1120px;
  margin: 14px auto 0;
  border: 1px solid rgba(0,0,0,.08);
  border-radius: 26px;
  background: #fff;
  padding: 20px;
}

.section h2 {
  margin: 0 0 12px;
}

.rows {
  display: grid;
  gap: 8px;
}

.rows div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  border-top: 1px solid rgba(0,0,0,.06);
  padding-top: 10px;
}

.rows span {
  color: #666;
  text-align: right;
}

@media (max-width: 860px) {
  .hero {
    grid-template-columns: 1fr;
    border-radius: 22px;
    padding: 18px;
  }

  .heroActions {
    justify-content: stretch;
  }

  .heroActions button {
    flex: 1;
  }

  .grid {
    grid-template-columns: 1fr;
  }

  .rows div {
    display: grid;
  }

  .rows span {
    text-align: left;
  }
}
''')

# --------------------------------------------------------------------
# 4. Replace account pages with the wired action panel.
# --------------------------------------------------------------------
pages = {
    "src/app/account/page.tsx": ("overview", "Account", "Manage your STREAMS account with real loading, billing, credits, and activity events."),
    "src/app/account/profile/page.tsx": ("profile", "Profile", "Update and review profile-level account information."),
    "src/app/account/settings/page.tsx": ("settings", "Settings", "Control workspace, product, and account preferences."),
    "src/app/account/privacy/page.tsx": ("privacy", "Privacy", "Review privacy controls and data-related account states."),
    "src/app/account/billing/page.tsx": ("billing", "Billing", "Manage Stripe billing portal and checkout actions with live billing activity."),
    "src/app/account/credits/page.tsx": ("credits", "Credits and usage", "Refresh credits, review usage, and start credit checkout with live credit activity."),
    "src/app/account/modules/page.tsx": ("modules", "Capabilities and modules", "Review module access, credit usage, and upgrade paths."),
    "src/app/account/personalization/page.tsx": ("personalization", "Personalization", "Control assistant preferences, style, and account behavior."),
    "src/app/account/language/page.tsx": ("language", "Language", "Manage language, region, and formatting preferences."),
    "src/app/account/apps/page.tsx": ("apps", "Apps and connectors", "Review project and connector actions with project and GitHub activity hooks."),
    "src/app/account/gift/page.tsx": ("gift", "Gift and invite credits", "Prepare invite, referral, and credit gifting account flows."),
    "src/app/account/help/page.tsx": ("help", "Help and status", "Access help, support, and status surfaces with account activity states."),
    "src/app/account/learn-more/page.tsx": ("learnMore", "Learn more", "Explore STREAMS capabilities and upgrade paths."),
}

for path, data in pages.items():
    kind, title, description = data
    write(path, 'import StreamsAccountActionPanel from "@/components/account/StreamsAccountActionPanel";\n\n'
                'export default function AccountPage() {\n'
                '  return (\n'
                '    <StreamsAccountActionPanel\n'
                f'      pageKind="{kind}"\n'
                f'      title="{title}"\n'
                f'      description="{description}"\n'
                '    />\n'
                '  );\n'
                '}\n')

print("Built account/billing/credits emitter wiring and redesigned account pages.")
