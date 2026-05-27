"use client";

import Link from "next/link";
import { AccountMobileShell } from "@/components/account/AccountMobileShell";

export default function AccountHelpPage() {
  return (
    <AccountMobileShell title="Help & Status" subtitle="Help center, docs, provider status, and support.">
      <section className="accountGrid">
        <Link className="accountButton" href="/help-center">Help center</Link>
        <Link className="accountButton secondary" href="/docs">Docs</Link>
        <Link className="accountButton secondary" href="/system-status">System status</Link>
        <Link className="accountButton secondary" href="/contact">Contact support</Link>
      </section>
    </AccountMobileShell>
  );
}
