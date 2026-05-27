"use client";

import Link from "next/link";
import { AccountMobileShell } from "@/components/account/AccountMobileShell";

export default function AccountGiftPage() {
  return (
    <AccountMobileShell title="Gift / Invite / Credits" subtitle="Invite teammates, gift credits, and referral paths.">
      <section className="accountCard">
        <h2 className="accountCardTitle">Invite teammate</h2>
        <p className="accountMuted">Team invitation backend exists. Use the team page for current production invite flow.</p>
        <Link className="accountButton" href="/dashboard/team">Open team invites</Link>
      </section>
      <section className="accountBlocked">
        Gift credits require Stripe credit-pack price IDs, a gift checkout route, and credit_ledger recipient support.
      </section>
    </AccountMobileShell>
  );
}
