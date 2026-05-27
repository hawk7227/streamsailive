"use client";

import { FormEvent, useEffect, useState } from "react";
import { AccountMobileShell } from "@/components/account/AccountMobileShell";
import { useAuth } from "@/contexts/AuthContext";

export default function AccountProfilePage() {
  const { user, profile, workspace, updateProfile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setFullName(profile?.full_name || "");
    setOrgName(profile?.org_name || "");
    setAvatarUrl(profile?.avatar_url || "");
  }, [profile]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("Saving profile...");
    const result = await updateProfile({
      full_name: fullName || null,
      org_name: orgName || null,
      avatar_url: avatarUrl || null,
    });
    if (result.error) {
      setMessage(result.error);
      return;
    }
    await refreshProfile();
    setMessage("Profile saved.");
  };

  return (
    <AccountMobileShell
      title="Profile"
      subtitle="Manage your visible account identity."
      actions={<button className="accountButton" type="submit" form="profileForm">Save profile</button>}
    >
      <section className="accountCard">
        <h2 className="accountCardTitle">Account identity</h2>
        <p className="accountMuted">{user?.email || profile?.email || "No email loaded"}</p>
        <p className="accountMuted">Workspace: {workspace?.name || "Loading workspace"}</p>
      </section>

      <form id="profileForm" className="accountCard accountForm" onSubmit={save}>
        <label>
          Full name
          <input value={fullName} onChange={(event) => setFullName(event.target.value)} />
        </label>
        <label>
          Organization
          <input value={orgName} onChange={(event) => setOrgName(event.target.value)} />
        </label>
        <label>
          Avatar URL
          <input value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} />
        </label>
        {message ? <p className="accountMuted">{message}</p> : null}
      </form>

      <section className="accountBlocked">
        Avatar upload to storage is blocked until a production avatar bucket/upload route is confirmed.
        Current real save path supports avatar_url through AuthContext.updateProfile().
      </section>
    </AccountMobileShell>
  );
}
