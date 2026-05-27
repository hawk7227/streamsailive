"use client";

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
