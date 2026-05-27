"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AccountMobileShell } from "@/components/account/AccountMobileShell";

type AccountStatus = {
  subscriptions?: Array<Record<string, unknown>>;
  entitlements?: Array<Record<string, unknown>>;
};

export default function AccountBillingPage() {
  const [account, setAccount] = useState<AccountStatus | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/streams-ai/account")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Unable to load billing status");
        setAccount(data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load billing status"));
  }, []);

  return (
    <AccountMobileShell
      title="Billing"
      subtitle="Subscriptions, Stripe billing, invoices, and payment status."
      actions={<Link className="accountButton" href="/pricing">Upgrade / Add Modules</Link>}
    >
      {error ? <section className="accountBlocked">Billing status blocked: {error}</section> : null}

      <section className="accountCard">
        <h2 className="accountCardTitle">Active subscriptions</h2>
        <ul className="accountList">
          {(account?.subscriptions || []).length ? (
            account?.subscriptions?.map((item, index) => (
              <li className="accountRowCard" key={String(item.id || index)}>
                <strong>{String(item.product_id || item.plan_id || "Subscription")}</strong>
                <span className="accountMuted">{String(item.status || "status unavailable")}</span>
              </li>
            ))
          ) : (
            <li className="accountRowCard">
              <strong>No active subscription rows loaded</strong>
              <span className="accountMuted">Use pricing to start or update a plan.</span>
            </li>
          )}
        </ul>
      </section>

      <section className="accountCard">
        <h2 className="accountCardTitle">Billing actions</h2>
        <div className="accountGrid">
          <Link className="accountButton" href="/pricing">Open pricing</Link>
          <Link className="accountButton secondary" href="/account/modules">View modules</Link>
        </div>
      </section>

      <section className="accountBlocked">
        Stripe portal must be called through /api/stripe/portal by an authenticated action.
        Do not show fake invoices or payment methods.
      </section>
    </AccountMobileShell>
  );
}
