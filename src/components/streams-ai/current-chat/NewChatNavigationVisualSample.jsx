"use client";

import { useRouter } from "next/navigation";
import {
  Bot,
  CalendarDays,
  CheckSquare,
  FileText,
  FolderKanban,
  Home,
  Image,
  LayoutTemplate,
  Mic2,
  Plug,
  Search,
  Settings,
  Sparkles,
  Video,
  Workflow,
  Wrench,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const GROUPS = [
  {
    label: "Workspace",
    items: [
      ["Home", Home, "/streams-ai"],
      ["Projects", FolderKanban, "/dashboard/projects"],
      ["Workspace", Workflow, "/streams-ai?view=workspace"],
      ["Files", FileText, "/dashboard/files"],
      ["Calendar", CalendarDays, "/streams-ai?destination=calendar"],
      ["Tasks", CheckSquare, "/dashboard/tasks"],
      ["A.S.K. AI", Bot, "/streams-ai"],
    ],
  },
  {
    label: "Create",
    items: [
      ["A.S.K. Knock", Wrench, "/streams-ai/streams-builder/workspace"],
      ["Image Studio", Image, "/streams-ai?destination=image-studio"],
      ["Video Studio", Video, "/streams-ai/streams-builder/gen-video"],
      ["Voice Studio", Mic2, "/streams-ai?destination=voice-studio"],
      ["Automation", Sparkles, "/streams-ai?destination=automation"],
    ],
  },
  {
    label: "Manage",
    items: [
      ["Templates", LayoutTemplate, "/streams-ai?destination=templates"],
      ["Integrations", Plug, "/streams-ai?destination=integrations"],
      ["Settings", Settings, "/dashboard/settings"],
    ],
  },
];

export default function NewChatNavigationVisualSample({ onNewProject }) {
  const router = useRouter();
  const { user, profile, membershipRole, workspaceLoading } = useAuth();
  const canOperate = membershipRole === "owner" || membershipRole === "admin";

  function navigate(route) {
    if (route) router.push(route);
  }

  return (
    <aside className="newChatNavigationVisualSample" aria-label="Streams Workspace navigation">
      <header className="sampleMenuBrand">
        <span className="sampleMenuOrb" aria-hidden="true"><i /></span>
        <span>
          <strong>STREAMS AI</strong>
          <small>Streams Workspace</small>
          <small>Hosted by A.S.K. AI</small>
        </span>
      </header>

      <div className="sampleTopActions" aria-label="Workspace actions">
        <button type="button" aria-label="Search workspace" title="Search workspace" onClick={() => router.push("/streams-ai?destination=search")}><Search size={17} /></button>
        <button type="button" aria-label="Create new project" title="Create new project" onClick={onNewProject}>+</button>
      </div>

      <div className="sampleMenuScroll">
        {GROUPS.map((group) => (
          <section className="sampleMenuGroup" key={group.label} aria-label={group.label}>
            <h2>{group.label}</h2>
            {group.items.map(([label, Icon, route]) => (
              <button
                key={`${group.label}:${label}`}
                type="button"
                onClick={() => navigate(route)}
                className={label === "Home" ? "sampleMenuItem active" : "sampleMenuItem"}
                aria-label={label}
                title={label}
              >
                <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </section>
        ))}

        {canOperate ? (
          <section className="sampleMenuGroup adminMenuGroup" aria-label="Administration">
            <h2>Administration</h2>
            <button type="button" className="sampleMenuItem adminMenuItem" onClick={() => router.push("/admin/operations")}>
              <Wrench size={16} strokeWidth={1.75} aria-hidden="true" />
              <span>Operations</span>
            </button>
          </section>
        ) : null}

        {user ? (
          <footer className="sampleAccountSummary">
            <span className="sampleAvatar" aria-hidden="true">{String(profile?.full_name || user.email || "S").charAt(0).toUpperCase()}</span>
            <span className="sampleAccountText">
              <strong>{profile?.full_name || user.email || "Signed in"}</strong>
              <small>{workspaceLoading ? "Checking access…" : membershipRole || "member"}</small>
            </span>
          </footer>
        ) : null}
      </div>

      <style jsx>{`
        .newChatNavigationVisualSample{position:fixed;inset:0 auto 0 0;z-index:49000;width:224px;min-width:224px;height:100dvh;display:grid;grid-template-rows:auto auto minmax(0,1fr);background:linear-gradient(180deg,#030712 0%,#040817 100%);border-right:1px solid rgba(148,163,184,.1);overflow:hidden;color:#f8fafc}
        .sampleMenuBrand{display:flex;align-items:flex-start;gap:10px;padding:18px 16px 13px}.sampleMenuBrand>span:last-child{display:grid;gap:1px;min-width:0}.sampleMenuBrand strong{font-size:12px;letter-spacing:.08em}.sampleMenuBrand small{font-size:8px;line-height:1.35;color:#8190aa}.sampleMenuOrb{width:29px;height:29px;flex:0 0 auto;border-radius:50%;display:grid;place-items:center;background:#071426;border:1px solid #163a6a;box-shadow:0 0 18px rgba(37,99,235,.2)}.sampleMenuOrb i{width:10px;height:10px;border-radius:50%;background:#2dd4ff;box-shadow:0 0 12px #2dd4ff}
        .sampleTopActions{display:flex;justify-content:flex-end;gap:5px;padding:0 12px 10px}.sampleTopActions button{width:31px;height:31px;display:grid;place-items:center;border:0;border-radius:8px;background:transparent;color:#aebbd0;cursor:pointer}.sampleTopActions button:hover,.sampleTopActions button:focus-visible{background:rgba(59,130,246,.12);color:#fff;outline:none}
        .sampleMenuScroll{min-height:0;overflow-y:auto;overflow-x:hidden;padding:0 9px 16px;scrollbar-width:none}.sampleMenuScroll::-webkit-scrollbar{display:none}.sampleMenuGroup{display:grid;gap:1px;margin-bottom:13px}.sampleMenuGroup h2{margin:5px 8px 4px;color:#65748d;font-size:8px;line-height:1.2;text-transform:uppercase;letter-spacing:.16em}.sampleMenuItem{width:100%;min-height:33px;display:flex;align-items:center;gap:10px;border:0;border-radius:7px;background:transparent;color:#aab5c8;text-align:left;padding:7px 9px;font-size:11px;font-weight:600;white-space:nowrap;cursor:pointer}.sampleMenuItem:hover,.sampleMenuItem:focus-visible{background:rgba(59,130,246,.09);color:#fff;outline:none}.sampleMenuItem.active{background:linear-gradient(90deg,rgba(29,110,224,.95),rgba(89,48,184,.9));color:#fff}.adminMenuGroup{padding-top:4px;border-top:1px solid rgba(148,163,184,.08)}.adminMenuItem{color:#7dd3fc}
        .sampleAccountSummary{display:flex;align-items:center;gap:9px;margin:12px 4px 0;padding:8px 5px;border:0;background:transparent}.sampleAvatar{width:25px;height:25px;display:grid;place-items:center;border-radius:50%;background:linear-gradient(135deg,#0ea5e9,#7c3aed);font-size:10px;font-weight:800;color:#fff}.sampleAccountText{display:grid;gap:1px;min-width:0}.sampleAccountText strong{overflow:hidden;text-overflow:ellipsis;font-size:9px;color:#e5e7eb}.sampleAccountText small{font-size:8px;color:#7f8ca3;text-transform:capitalize}
        @media(max-width:760px){.newChatNavigationVisualSample{width:190px;min-width:190px}.sampleMenuBrand{padding-inline:11px}.sampleMenuItem{font-size:10px;padding-inline:8px}}
      `}</style>

      <style jsx global>{`
        .withNewChatVisualSample .streamsOperator > .operatorSidebar{display:none!important}
        .withNewChatVisualSample .streamsOperator{padding-left:224px!important}
        .withNewChatVisualSample .operatorMain{width:100%!important;min-width:0!important}
        @media(max-width:760px){.withNewChatVisualSample .streamsOperator{padding-left:190px!important}}
      `}</style>
    </aside>
  );
}
