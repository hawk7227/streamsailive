"use client";

import Link from "next/link";
import { AccountMobileShell } from "@/components/account/AccountMobileShell";

export default function AccountLearnMorePage() {
  return (
    <AccountMobileShell title="Learn more" subtitle="STREAMS capabilities, pricing, docs, and policies.">
      <section className="accountGrid">
        <Link className="accountButton" href="/features">Features</Link>
        <Link className="accountButton secondary" href="/pricing">Pricing</Link>
        <Link className="accountButton secondary" href="/products">Products</Link>
        <Link className="accountButton secondary" href="/privacy">Privacy</Link>
        <Link className="accountButton secondary" href="/terms">Terms</Link>
      </section>
    </AccountMobileShell>
  );
}
