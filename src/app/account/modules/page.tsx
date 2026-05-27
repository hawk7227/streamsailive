"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AccountMobileShell } from "@/components/account/AccountMobileShell";

const modules = [
  ["streams_ai_core", "STREAMS AI Core"],
  ["text_to_image_studio", "Text-to-Image Studio"],
  ["photo_to_motion_studio", "Photo-to-Motion Studio"],
  ["text_to_video_studio", "Text-to-Video Studio"],
  ["snap_pic_click_studio", "Snap Pic Click Studio"],
  ["voice_caption_studio", "Voice & Caption Studio"],
  ["idea_launch_studio", "Idea / Launch Studio"],
  ["domain_launch_studio", "Domain Launch Studio"],
  ["image_editor_studio", "Image Editor Studio"],
  ["video_editor_studio", "Video Editor Studio"],
  ["full_platform_bundle", "Full Platform Bundle"],
];

export default function AccountModulesPage() {
  const [entitlements, setEntitlements] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/streams-ai/account")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Unable to load modules");
        setEntitlements(Array.isArray(data?.entitlements) ? data.entitlements : []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load modules"));
  }, []);

  const activeProducts = useMemo(
    () => new Set(entitlements.map((item) => String(item.product_id || item.productId || ""))),
    [entitlements]
  );

  return (
    <AccountMobileShell
      title="My Plan & Modules"
      subtitle="All product modules with active, trial, or locked state."
      actions={<Link className="accountButton" href="/pricing">Upgrade to bundle</Link>}
    >
      {error ? <section className="accountBlocked">Modules blocked: {error}</section> : null}

      <section className="accountCard">
        <h2 className="accountCardTitle">Full Platform Bundle</h2>
        <p className="accountMuted">Best-value upsell. Unlocks all modules and highest included credits when entitlement is active.</p>
        <Link className="accountButton" href="/pricing">View bundle pricing</Link>
      </section>

      <section className="accountGrid">
        {modules.map(([id, name]) => {
          const active = activeProducts.has(id);
          return (
            <article className="accountCard" key={id}>
              <span className="accountBadge">{active ? "Active" : "Locked / available"}</span>
              <h2 className="accountCardTitle">{name}</h2>
              <p className="accountMuted">
                Product ID: {id}. Trial policy: one capped 7-day trial per workspace when backend trial entitlement exists.
              </p>
              <Link className={active ? "accountButton secondary" : "accountButton"} href="/pricing">
                {active ? "Manage plan" : "Subscribe / start trial"}
              </Link>
            </article>
          );
        })}
      </section>
    </AccountMobileShell>
  );
}
