"use client";

import { AccountMobileShell } from "@/components/account/AccountMobileShell";

export default function AccountPrivacyPage() {
  return (
    <AccountMobileShell title="Privacy" subtitle="Memory, chat history, export, and deletion controls.">
      <section className="accountCard">
        <h2 className="accountCardTitle">Memory</h2>
        <p className="accountMuted">Memory controls must write to the STREAMS memory layer when connected.</p>
      </section>
      <section className="accountCard">
        <h2 className="accountCardTitle">Chat history</h2>
        <p className="accountMuted">Chat history controls must target the real Streams AI session storage.</p>
      </section>
      <section className="accountBlocked">
        Privacy controls are blocked until memory/chat deletion/export routes are wired for account-level self-service.
      </section>
    </AccountMobileShell>
  );
}
