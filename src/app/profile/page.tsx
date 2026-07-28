"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function ProfilePage() {
  const router = useRouter();
  const {
    user,
    profile,
    workspace,
    membershipRole,
    plan,
    loading,
    profileLoading,
    updateProfile,
  } = useAuth();
  const [fullName, setFullName] = useState("");
  const [organization, setOrganization] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=/profile");
  }, [loading, user, router]);

  useEffect(() => {
    setFullName(profile?.full_name || "");
    setOrganization(profile?.org_name || "");
    setAvatarUrl(profile?.avatar_url || "");
  }, [profile]);

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    const result = await updateProfile({
      full_name: fullName.trim() || null,
      org_name: organization.trim() || null,
      avatar_url: avatarUrl.trim() || null,
    });
    setSaving(false);
    setMessage(
      result.error
        ? { type: "error", text: result.error }
        : { type: "success", text: "Profile saved." },
    );
  }

  if (loading || profileLoading || !user) {
    return <main className="profilePage"><section className="profileCard"><p>Loading your profile…</p></section></main>;
  }

  const displayName = fullName || user.user_metadata?.full_name || user.email || "Streams user";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <main className="profilePage">
      <section className="profileCard">
        <header className="profileHeader">
          <button type="button" className="backButton" onClick={() => router.push("/streams-ai")}>← Back to Streams</button>
          <div className="identityRow">
            <div className="avatar">
              {avatarUrl ? <img src={avatarUrl} alt="Profile" /> : <span>{initial}</span>}
            </div>
            <div>
              <p className="eyebrow">ACCOUNT</p>
              <h1>Profile</h1>
              <p>Manage the identity attached to your Streams account and workspace.</p>
            </div>
          </div>
        </header>

        <div className="accountGrid" aria-label="Account summary">
          <article><span>Email</span><strong>{user.email || "Not available"}</strong></article>
          <article><span>Workspace</span><strong>{workspace?.name || "Personal workspace"}</strong></article>
          <article><span>Role</span><strong>{membershipRole || "member"}</strong></article>
          <article><span>Plan</span><strong>{plan?.name || "Current plan"}</strong></article>
        </div>

        <form onSubmit={saveProfile} className="profileForm">
          <label>
            <span>Full name</span>
            <input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" maxLength={120} />
          </label>
          <label>
            <span>Organization or workspace name</span>
            <input value={organization} onChange={(event) => setOrganization(event.target.value)} autoComplete="organization" maxLength={160} />
          </label>
          <label>
            <span>Profile image URL</span>
            <input value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} type="url" inputMode="url" placeholder="https://…" maxLength={2048} />
            <small>Use a hosted HTTPS image. Large image data is not stored directly in the profile record.</small>
          </label>
          <label>
            <span>Sign-in email</span>
            <input value={user.email || ""} disabled />
            <small>Email and connected login providers are managed by the authentication system.</small>
          </label>

          {message ? <p className={message.type === "success" ? "message success" : "message error"}>{message.text}</p> : null}

          <footer>
            <button type="button" className="secondary" onClick={() => router.push("/dashboard/settings")}>Account settings</button>
            {(membershipRole === "owner" || membershipRole === "admin") ? (
              <button type="button" className="secondary" onClick={() => router.push("/admin/operations")}>Admin operations</button>
            ) : null}
            <button type="submit" disabled={saving}>{saving ? "Saving…" : "Save profile"}</button>
          </footer>
        </form>
      </section>
      <style jsx>{`
        .profilePage{min-height:100svh;padding:32px;background:radial-gradient(circle at top right,#201643 0,transparent 36%),#020713;color:#f8fafc}.profileCard{width:min(920px,100%);margin:0 auto;border:1px solid rgba(125,211,252,.22);border-radius:24px;background:rgba(7,16,31,.96);box-shadow:0 30px 90px rgba(0,0,0,.45);overflow:hidden}.profileHeader{padding:24px 26px 20px;border-bottom:1px solid rgba(148,163,184,.14)}.backButton{border:0;background:transparent;color:#7dd3fc;font-weight:800;cursor:pointer;margin-bottom:20px}.identityRow{display:flex;align-items:center;gap:18px}.avatar{width:76px;height:76px;flex:0 0 76px;display:grid;place-items:center;border-radius:22px;overflow:hidden;background:linear-gradient(135deg,#2563eb,#7c3aed);font-size:30px;font-weight:900}.avatar img{width:100%;height:100%;object-fit:cover}.eyebrow{margin:0 0 5px;color:#7dd3fc;font-size:10px;font-weight:900;letter-spacing:.18em}.identityRow h1{margin:0;font-size:34px}.identityRow p:last-child{margin:6px 0 0;color:#a5b4c8}.accountGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;padding:18px 26px;background:rgba(15,23,42,.55)}.accountGrid article{min-width:0;padding:13px;border:1px solid rgba(148,163,184,.14);border-radius:14px;background:#081222}.accountGrid span{display:block;margin-bottom:6px;color:#8291aa;font-size:10px;text-transform:uppercase;letter-spacing:.12em}.accountGrid strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;text-transform:none}.profileForm{display:grid;gap:17px;padding:26px}.profileForm label{display:grid;gap:7px}.profileForm label>span{font-size:12px;font-weight:850;color:#dbeafe}.profileForm input{width:100%;box-sizing:border-box;min-height:46px;border:1px solid rgba(148,163,184,.22);border-radius:11px;background:#0b1526;color:#f8fafc;padding:0 13px;font:inherit}.profileForm input:focus{outline:2px solid #38bdf8;outline-offset:1px}.profileForm input:disabled{opacity:.62;cursor:not-allowed}.profileForm small{color:#7f8ea5;font-size:10px}.profileForm footer{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;padding-top:8px}.profileForm button{min-height:42px;border:0;border-radius:11px;padding:0 16px;background:linear-gradient(90deg,#2563eb,#7c3aed);color:#fff;font-weight:850;cursor:pointer}.profileForm button.secondary{border:1px solid rgba(148,163,184,.24);background:#111b2d;color:#dbeafe}.profileForm button:disabled{opacity:.55;cursor:wait}.message{margin:0;padding:11px 13px;border-radius:10px;font-size:12px}.message.success{background:rgba(16,185,129,.12);color:#6ee7b7}.message.error{background:rgba(239,68,68,.12);color:#fca5a5}@media(max-width:760px){.profilePage{padding:12px}.profileCard{border-radius:18px}.identityRow{align-items:flex-start}.accountGrid{grid-template-columns:1fr 1fr;padding:14px}.profileHeader,.profileForm{padding:18px}.profileForm footer{justify-content:stretch}.profileForm button{flex:1}}
      `}</style>
    </main>
  );
}
