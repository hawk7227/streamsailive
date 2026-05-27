"use client";

import { AccountMobileShell } from "@/components/account/AccountMobileShell";

export default function AccountPersonalizationPage() {
  return (
    <AccountMobileShell title="Personalization" subtitle="How STREAMS should respond, build, and generate.">
      <section className="accountCard accountForm">
        <label>What should STREAMS call you?<input placeholder="Display name preference" /></label>
        <label>Preferred tone<select defaultValue="direct"><option value="direct">Direct</option><option value="friendly">Friendly</option><option value="technical">Technical</option></select></label>
        <label>Custom instructions<textarea placeholder="What should STREAMS always know?" /></label>
      </section>
      <section className="accountBlocked">
        Saving personalization is blocked until profiles.preferences JSONB or a user_personalization table is confirmed.
      </section>
    </AccountMobileShell>
  );
}
