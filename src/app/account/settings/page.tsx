"use client";

import Link from "next/link";
import { AccountMobileShell } from "@/components/account/AccountMobileShell";
import { useAuth } from "@/contexts/AuthContext";

export default function AccountSettingsPage() {
  const { profile, plan, workspace } = useAuth();

  return (
    <AccountMobileShell title="Settings" subtitle="General account and workspace settings.">
      <section className="accountCard">
        <h2 className="accountCardTitle">General</h2>
        <ul className="accountList">
          <li className="accountRowCard"><strong>Default landing page</strong><span className="accountMuted">/streams-ai</span></li>
          <li className="accountRowCard"><strong>Workspace</strong><span className="accountMuted">{workspace?.name || "Loading workspace"}</span></li>
          <li className="accountRowCard"><strong>Plan</strong><span className="accountMuted">{plan?.name || profile?.plan_id || "Free"}</span></li>
        </ul>
      </section>

      <section className="accountCard">
        <h2 className="accountCardTitle">Existing dashboard settings</h2>
        <p className="accountMuted">The current production profile editor already exists at /dashboard/settings.</p>
        <Link className="accountButton" href="/dashboard/settings">Open dashboard settings</Link>
      </section>

      <section className="accountBlocked">
        Theme, compact mode, default creation mode, and notification preferences require profiles.preferences JSONB or a dedicated account_settings table.
      </section>
    </AccountMobileShell>
  );
}
