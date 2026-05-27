"use client";

import Link from "next/link";
import { AccountMobileShell } from "@/components/account/AccountMobileShell";

const apps = [
  ["Web app", "Available"],
  ["GitHub connector", "Available through connector route"],
  ["Chrome extension", "Blocked: extension package/install URL not configured"],
  ["Desktop app", "Blocked: desktop package not configured"],
  ["Mobile app", "PWA-ready foundation added; native store package not configured"],
  ["API access", "See dashboard API"],
];

export default function AccountAppsPage() {
  return (
    <AccountMobileShell title="Apps & Extensions" subtitle="Connectors, install options, apps, and API access.">
      <section className="accountGrid">
        {apps.map(([name, status]) => (
          <article className="accountCard" key={name}>
            <h2 className="accountCardTitle">{name}</h2>
            <p className="accountMuted">{status}</p>
          </article>
        ))}
      </section>
      <section className="accountCard">
        <Link className="accountButton" href="/dashboard/integrations">Open integrations</Link>
      </section>
    </AccountMobileShell>
  );
}
