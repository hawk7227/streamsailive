"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AccountMobileShell } from "@/components/account/AccountMobileShell";
import { useAuth } from "@/contexts/AuthContext";

type AccountStatus = {
  ok?: boolean;
  credits?: { balance?: number; ledger?: Array<Record<string, unknown>> };
  entitlements?: Array<Record<string, unknown>>;
  subscriptions?: Array<Record<string, unknown>>;
  usageEvents?: Array<Record<string, unknown>>;
};

export default function AccountOverviewPage() {
  const { user, profile, plan, usage, workspace, membershipRole, refreshUsage } = useAuth();
  const [account, setAccount] = useState<AccountStatus | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void refreshUsage();
    fetch("/api/streams-ai/account")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Unable to load account status");
        setAccount(data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load account status"));
  }, [refreshUsage]);

  return (
    <AccountMobileShell
      title="Account"
      subtitle="Mobile-first account overview for your STREAMS workspace."
      actions={<Link className="accountButton" href="/account/modules">Manage modules</Link>}
    >
      <section className="accountCard">
        <h2 className="accountCardTitle">{profile?.full_name || user?.email || "Signed in user"}</h2>
        <p className="accountMuted">{user?.email || profile?.email || "No email loaded"}</p>
        <span className="accountBadge">{workspace?.name || "Workspace loading"}</span>
      </section>

      {error ? <section className="accountBlocked">Account status blocked: {error}</section> : null}

      <section className="accountKpis">
        <article className="accountKpi">
          <strong>{String(account?.credits?.balance ?? "—")}</strong>
          <span>Available credits</span>
        </article>
        <article className="accountKpi">
          <strong>{usage ? String(usage.used) : "—"}</strong>
          <span>Generations used</span>
        </article>
        <article className="accountKpi">
          <strong>{plan?.name || profile?.plan_id || "Free"}</strong>
          <span>Current plan</span>
        </article>
        <article className="accountKpi">
          <strong>{membershipRole || "—"}</strong>
          <span>Workspace role</span>
        </article>
      </section>

      <section className="accountCard">
        <h2 className="accountCardTitle">Quick actions</h2>
        <div className="accountGrid">
          <Link className="accountButton" href="/account/credits">Credits / Usage</Link>
          <Link className="accountButton secondary" href="/account/modules">My Plan & Modules</Link>
          <Link className="accountButton secondary" href="/account/profile">Profile</Link>
          <Link className="accountButton secondary" href="/account/billing">Billing</Link>
        </div>
      </section>
    </AccountMobileShell>
  );
}
