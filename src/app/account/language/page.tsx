"use client";

import { AccountMobileShell } from "@/components/account/AccountMobileShell";

export default function AccountLanguagePage() {
  return (
    <AccountMobileShell title="Language" subtitle="Locale, timezone, date, time, and currency preferences.">
      <section className="accountCard accountForm">
        <label>UI language<select defaultValue="en-US"><option value="en-US">English (US)</option></select></label>
        <label>Timezone<input placeholder="America/Phoenix" /></label>
        <label>Currency<select defaultValue="USD"><option value="USD">USD</option></select></label>
      </section>
      <section className="accountBlocked">
        Language persistence is blocked until profiles.locale, profiles.timezone, and currency preference storage are confirmed.
      </section>
    </AccountMobileShell>
  );
}
