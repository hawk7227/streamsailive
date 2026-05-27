"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AccountMobileShell } from "@/components/account/AccountMobileShell";

type CreditsResponse = {
  ok?: boolean;
  balance?: number;
  ledger?: Array<Record<string, unknown>>;
};

export default function AccountCreditsPage() {
  const [credits, setCredits] = useState<CreditsResponse | null>(null);
  const [usage, setUsage] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/streams-ai/credits?limit=100").then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Unable to load credits");
        return data;
      }),
      fetch("/api/usage").then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Unable to load usage");
        return data;
      }),
    ])
      .then(([creditData, usageData]) => {
        setCredits(creditData);
        setUsage(usageData);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load credit usage"));
  }, []);

  const ledger = credits?.ledger || [];

  return (
    <AccountMobileShell
      title="Credits / Usage"
      subtitle="Customer-facing credits, reservations, usage, and refunds."
      actions={<Link className="accountButton" href="/pricing">Buy credits</Link>}
    >
      {error ? <section className="accountBlocked">Credits blocked: {error}</section> : null}

      <section className="accountKpis">
        <article className="accountKpi">
          <strong>{String(credits?.balance ?? "—")}</strong>
          <span>Available credits</span>
        </article>
        <article className="accountKpi">
          <strong>{String(usage?.used ?? "—")}</strong>
          <span>Credits/usage used this period</span>
        </article>
        <article className="accountKpi">
          <strong>{String(usage?.remaining ?? "—")}</strong>
          <span>Remaining plan usage</span>
        </article>
        <article className="accountKpi">
          <strong>{ledger.length}</strong>
          <span>Ledger events loaded</span>
        </article>
      </section>

      <section className="accountCard">
        <h2 className="accountCardTitle">Recent credit transactions</h2>
        <ul className="accountList">
          {ledger.length ? ledger.slice(0, 20).map((entry, index) => (
            <li className="accountRowCard" key={String(entry.id || index)}>
              <strong>{String(entry.amount ?? entry.credit_amount ?? "Credit event")}</strong>
              <span className="accountMuted">{String(entry.reason || entry.source || entry.created_at || "Ledger entry")}</span>
            </li>
          )) : (
            <li className="accountRowCard">
              <strong>No credit ledger rows loaded</strong>
              <span className="accountMuted">This is truthful empty state from /api/streams-ai/credits.</span>
            </li>
          )}
        </ul>
      </section>

      <section className="accountBlocked">
        Reserved credits and refund/release views require credit_reservations or reservation status fields.
        Provider-cost/profit view must stay admin-only.
      </section>
    </AccountMobileShell>
  );
}
