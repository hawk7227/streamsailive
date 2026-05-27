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
      await callGroupChatWithActivity({
        sessionId: groupSessionId,
        action,
        email: groupEmail,
        name: groupName,
      });
      setLastAction(`Group chat ${action} complete.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : `Group chat ${action} failed.`;
      setError(message);
      setLastAction(message);
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

      <section className={styles.proofBar}>
        <strong>Last action</strong>
        <span>{lastAction || "No account action has run yet."}</span>
      </section>

      <section className={styles.groupCard}>
        <div>
          <p className={styles.kicker}>Group chat backend test</p>
          <h2>Real session test</h2>
          <p>
            This calls /api/streams-ai/group-chat against a real session id and emits group chat activity events.
          </p>
        </div>

        <label>
          Session ID
          <input
            value={groupSessionId}
            onChange={(event) => setGroupSessionId(event.target.value)}
            placeholder="Paste a real STREAMS chat session id"
          />
        </label>

        <label>
          Invite email
          <input
            value={groupEmail}
            onChange={(event) => setGroupEmail(event.target.value)}
            placeholder="person@example.com"
            type="email"
          />
        </label>

        <label>
          Group name
          <input
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
            placeholder="STREAMS Group Chat"
          />
        </label>

        <div className={styles.groupActions}>
          <button type="button" onClick={() => runGroupChatTest("create")}>Create group</button>
          <button type="button" onClick={() => runGroupChatTest("invite")}>Invite</button>
          <button type="button" onClick={() => runGroupChatTest("rename")}>Rename</button>
          <button type="button" onClick={() => runGroupChatTest("remove")}>Remove</button>
          <button type="button" onClick={() => runGroupChatTest("leave")}>Leave</button>
        </div>
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
