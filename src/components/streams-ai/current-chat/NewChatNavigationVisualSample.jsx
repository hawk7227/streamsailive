"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AppWindow, Archive, Bot, BriefcaseBusiness, CalendarDays, Captions,
  CheckSquare, CircleUserRound, Clapperboard, FileText, FolderKanban,
  Globe2, Home, Image, Images, LayoutDashboard, LayoutTemplate, Lightbulb,
  Megaphone, Mic2, Palette, Plug, Rocket, Search, Settings, Sparkles,
  Video, WalletCards, Workflow, Wrench,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const GROUPS = [
  { label: "Workspace", items: [
    ["Home", Home, "/streams-ai", "home"],
    ["Portfolio", LayoutDashboard, "/streams-ai?destination=portfolio", "portfolio"],
    ["Projects", FolderKanban, "/streams-ai?destination=projects", "projects"],
    ["Workspace", Workflow, "/streams-ai?view=workspace", "workspace"],
    ["Files", FileText, "/streams-ai?destination=files", "files"],
  ]},
  { label: "A.S.K.", items: [
    ["A.S.K. AI", Bot, "/streams-ai", "home"],
    ["A.S.K. Knock", Wrench, "/streams-ai/streams-builder/workspace", "ask-knock"],
  ]},
  { label: "Create", items: [
    ["Creator Studio", Sparkles, "/streams-ai?destination=creator-studio", "creator-studio"],
    ["Image Studio", Image, "/streams-ai?destination=image-studio", "image-studio"],
    ["Video Studio", Video, "/streams-ai?destination=video-studio", "video-studio"],
    ["Voice Studio", Mic2, "/streams-ai?destination=voice-studio", "voice-studio"],
  ]},
  { label: "Launch", items: [
    ["Business Builder", BriefcaseBusiness, "/streams-ai?destination=business-builder", "business-builder"],
    ["Website Builder", Globe2, "/streams-ai?destination=website-builder", "website-builder"],
    ["App Builder", AppWindow, "/streams-ai?destination=app-builder", "app-builder"],
    ["Visual Concepts", Palette, "/streams-ai?destination=visual-concepts", "visual-concepts"],
    ["Revenue", WalletCards, "/streams-ai?destination=revenue", "revenue"],
    ["Preview + Launch", Rocket, "/streams-ai?destination=preview-launch", "preview-launch"],
  ]},
  { label: "Content", items: [
    ["Content", FileText, "/streams-ai?destination=content", "content"],
    ["Captions", Captions, "/streams-ai?destination=captions", "captions"],
    ["Ideas", Lightbulb, "/streams-ai?destination=ideas", "ideas"],
    ["Turn This Into You", Images, "/streams-ai?destination=turn-this-into-you", "turn-this-into-you"],
    ["Social Research", Megaphone, "/streams-ai?destination=social-research", "social-research"],
  ]},
  { label: "Manage", items: [
    ["Calendar", CalendarDays, "/streams-ai?destination=calendar", "calendar"],
    ["Assets", Archive, "/streams-ai?destination=assets", "assets"],
    ["Tasks", CheckSquare, "/streams-ai?destination=tasks", "tasks"],
    ["History", Clapperboard, "/streams-ai?destination=history", "history"],
    ["Automation", Sparkles, "/streams-ai?destination=automation", "automation"],
    ["Templates", LayoutTemplate, "/streams-ai?destination=templates", "templates"],
    ["Integrations", Plug, "/streams-ai?destination=integrations", "integrations"],
    ["Profile", CircleUserRound, "/profile", "profile"],
    ["Settings", Settings, "/dashboard/settings", "settings"],
  ]},
];

function currentDestination() {
  if (typeof window === "undefined") return "home";
  const url = new URL(window.location.href);
  return url.searchParams.get("view") === "workspace" ? "workspace" : (url.searchParams.get("destination") || "home");
}

export default function NewChatNavigationVisualSample({ onNewProject }) {
  const router = useRouter();
  const { user, profile, membershipRole, workspaceLoading } = useAuth();
  const canOperate = membershipRole === "owner" || membershipRole === "admin";
  const [activeDestination, setActiveDestination] = useState("home");

  useEffect(() => {
    const sync = () => setActiveDestination(currentDestination());
    sync();
    window.addEventListener("popstate", sync);
    window.addEventListener("streams-ai:destination-changed", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("streams-ai:destination-changed", sync);
    };
  }, []);

  function navigate(route, destination) {
    if (!route) return;
    setActiveDestination(destination || "home");
    router.push(route);
    window.dispatchEvent(new CustomEvent("streams-ai:destination-changed", { detail: { destination } }));
  }

  return (
    <aside className="newChatNavigationVisualSample" aria-label="Streams Workspace navigation">
      <header className="sampleMenuBrand">
        <span className="sampleMenuOrb" aria-hidden="true"><i /></span>
        <span><strong>STREAMS AI</strong><small>Streams Workspace</small><small>Hosted by A.S.K. AI</small></span>
      </header>

      <div className="sampleTopActions" aria-label="Workspace actions">
        <button type="button" aria-label="Search workspace" title="Search workspace" onClick={() => navigate("/streams-ai?destination=search", "search")}><Search size={17} /></button>
        <button type="button" aria-label="Create new project" title="Create new project" onClick={onNewProject}>+</button>
      </div>

      <div className="sampleMenuScroll">
        {GROUPS.map((group) => (
          <section className="sampleMenuGroup" key={group.label} aria-label={group.label}>
            <h2>{group.label}</h2>
            {group.items.map(([label, Icon, route, destination]) => (
              <button key={`${group.label}:${label}`} type="button" onClick={() => navigate(route, destination)} className={activeDestination === destination ? "sampleMenuItem active" : "sampleMenuItem"} aria-label={label} title={label}>
                <Icon size={16} strokeWidth={1.75} aria-hidden="true" /><span>{label}</span>
              </button>
            ))}
          </section>
        ))}

        {canOperate ? <section className="sampleMenuGroup adminMenuGroup" aria-label="Administration"><h2>Administration</h2><button type="button" className="sampleMenuItem adminMenuItem" onClick={() => router.push("/admin/operations")}><Wrench size={16} strokeWidth={1.75} aria-hidden="true" /><span>Operations</span></button></section> : null}

        {user ? <footer className="sampleAccountSummary"><span className="sampleAvatar" aria-hidden="true">{String(profile?.full_name || user.email || "S").charAt(0).toUpperCase()}</span><span className="sampleAccountText"><strong>{profile?.full_name || user.email || "Signed in"}</strong><small>{workspaceLoading ? "Checking access…" : membershipRole || "member"}</small></span></footer> : null}
      </div>

      <style jsx>{`
        .newChatNavigationVisualSample{position:fixed;inset:0 auto 0 0;z-index:49000;width:224px;min-width:224px;height:100dvh;display:grid;grid-template-rows:auto auto minmax(0,1fr);background:linear-gradient(180deg,#030712 0%,#040817 100%);border-right:1px solid rgba(148,163,184,.1);overflow:hidden;color:#f8fafc}
        .sampleMenuBrand{display:flex;align-items:flex-start;gap:10px;padding:16px 16px 10px}.sampleMenuBrand>span:last-child{display:grid;gap:1px;min-width:0}.sampleMenuBrand strong{font-size:12px;letter-spacing:.08em}.sampleMenuBrand small{font-size:8px;line-height:1.35;color:#8190aa}.sampleMenuOrb{width:29px;height:29px;flex:0 0 auto;border-radius:50%;display:grid;place-items:center;background:#071426;border:1px solid #163a6a;box-shadow:0 0 18px rgba(37,99,235,.2)}.sampleMenuOrb i{width:10px;height:10px;border-radius:50%;background:#2dd4ff;box-shadow:0 0 12px #2dd4ff}
        .sampleTopActions{display:flex;justify-content:flex-end;gap:5px;padding:0 12px 7px}.sampleTopActions button{width:30px;height:30px;display:grid;place-items:center;border:0;border-radius:8px;background:transparent;color:#aebbd0;cursor:pointer}.sampleTopActions button:hover,.sampleTopActions button:focus-visible{background:rgba(59,130,246,.12);color:#fff;outline:none}
        .sampleMenuScroll{min-height:0;overflow-y:auto;overflow-x:hidden;padding:0 9px 14px;scrollbar-width:none}.sampleMenuScroll::-webkit-scrollbar{display:none}.sampleMenuGroup{display:grid;gap:0;margin-bottom:9px}.sampleMenuGroup h2{margin:4px 8px 3px;color:#65748d;font-size:7px;line-height:1.2;text-transform:uppercase;letter-spacing:.16em}.sampleMenuItem{width:100%;min-height:29px;display:flex;align-items:center;gap:9px;border:0;border-radius:7px;background:transparent;color:#aab5c8;text-align:left;padding:5px 9px;font-size:10px;font-weight:600;white-space:nowrap;cursor:pointer}.sampleMenuItem:hover,.sampleMenuItem:focus-visible{background:rgba(59,130,246,.09);color:#fff;outline:none}.sampleMenuItem.active{background:linear-gradient(90deg,rgba(29,110,224,.95),rgba(89,48,184,.9));color:#fff}.adminMenuGroup{padding-top:4px;border-top:1px solid rgba(148,163,184,.08)}.adminMenuItem{color:#7dd3fc}
        .sampleAccountSummary{display:flex;align-items:center;gap:9px;margin:9px 4px 0;padding:7px 5px;border:0;background:transparent}.sampleAvatar{width:25px;height:25px;display:grid;place-items:center;border-radius:50%;background:linear-gradient(135deg,#0ea5e9,#7c3aed);font-size:10px;font-weight:800;color:#fff}.sampleAccountText{display:grid;gap:1px;min-width:0}.sampleAccountText strong{overflow:hidden;text-overflow:ellipsis;font-size:9px;color:#e5e7eb}.sampleAccountText small{font-size:8px;color:#7f8ca3;text-transform:capitalize}
        @media(max-width:900px){.newChatNavigationVisualSample{display:none}}
      `}</style>

      <style jsx global>{`
        @media(min-width:901px){
          .withNewChatVisualSample{width:100%;min-width:0;overflow:hidden}
          .withNewChatVisualSample .streamsOperator,.withNewChatVisualSample .destinationPage{width:100vw!important;min-width:0!important;height:100dvh!important;padding-left:224px!important;box-sizing:border-box!important;overflow:hidden!important}
          .withNewChatVisualSample .streamsOperator{display:block!important}
          .withNewChatVisualSample .streamsOperator > .operatorSidebar{display:none!important}
          .withNewChatVisualSample .operatorMain{display:block!important;width:100%!important;min-width:0!important;height:100dvh!important;min-height:0!important;margin:0!important;overflow:hidden!important}
          .withNewChatVisualSample .operatorChatPanel{width:100%!important;min-width:0!important;height:100%!important}
          .withNewChatVisualSample .operatorEmptyLanding{width:min(1120px,calc(100% - 64px))!important;max-width:none!important;margin-inline:auto!important}
          .withNewChatVisualSample .operatorLandingComposer{width:min(960px,100%)!important}
        }
        @media(max-width:900px){.withNewChatVisualSample .streamsOperator,.withNewChatVisualSample .destinationPage{padding-left:0!important}}
      `}</style>
    </aside>
  );
}
