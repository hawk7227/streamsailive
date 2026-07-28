"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, BriefcaseBusiness, CircleUserRound, FileText, FlaskConical, Globe2, Home, Image, MonitorSmartphone, Search, Settings, Video, Workflow, Wrench } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const GROUPS = [
  { label: "Core", items: [
    ["Chat", Bot, "/streams-ai", "home"],
    ["Workspace", Workflow, "/streams-ai?view=workspace", "workspace"],
  ]},
  { label: "Project Workspaces", items: [
    ["Default Project", Home, "/streams-ai?destination=projects", "projects"],
    ["Research Project", FlaskConical, "/streams-ai?destination=social-research", "social-research"],
    ["Video Project", Video, "/streams-ai?destination=video-studio", "video-studio"],
    ["Image / Brand Project", Image, "/streams-ai?destination=image-studio", "image-studio"],
    ["App Project", MonitorSmartphone, "/streams-ai?destination=app-builder", "app-builder"],
    ["Document / Report Project", FileText, "/streams-ai?destination=content", "content"],
    ["Product Campaign Project", BriefcaseBusiness, "/streams-ai?destination=business-builder", "business-builder"],
    ["Website Project", Globe2, "/streams-ai?destination=website-builder", "website-builder"],
  ]},
  { label: "Account", items: [
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
    return () => { window.removeEventListener("popstate", sync); window.removeEventListener("streams-ai:destination-changed", sync); };
  }, []);

  function navigate(route, destination) {
    setActiveDestination(destination || "home");
    router.push(route);
    window.dispatchEvent(new CustomEvent("streams-ai:destination-changed", { detail: { destination } }));
  }

  return <aside className="newChatNavigationVisualSample" aria-label="Streams Workspace navigation">
    <header className="sampleMenuBrand"><span className="sampleMenuOrb"><i /></span><span><strong>STREAMS AI</strong><small>Streams Workspace</small><small>Hosted by A.S.K. AI</small></span></header>
    <div className="sampleTopActions"><button aria-label="Search workspace" onClick={() => navigate("/streams-ai?destination=search", "search")}><Search size={17}/></button><button aria-label="Create new project" onClick={onNewProject}>+</button></div>
    <div className="sampleMenuScroll">
      {GROUPS.map((group) => <section className="sampleMenuGroup" key={group.label}><h2>{group.label}</h2>{group.items.map(([label, Icon, route, destination]) => <button key={label} onClick={() => navigate(route, destination)} className={activeDestination === destination ? "sampleMenuItem active" : "sampleMenuItem"}><Icon size={16}/><span>{label}</span></button>)}</section>)}
      {canOperate ? <section className="sampleMenuGroup adminMenuGroup"><h2>Administration</h2><button className="sampleMenuItem adminMenuItem" onClick={() => router.push("/admin/operations")}><Wrench size={16}/><span>Operations</span></button></section> : null}
      {user ? <footer className="sampleAccountSummary"><span className="sampleAvatar">{String(profile?.full_name || user.email || "S").charAt(0).toUpperCase()}</span><span className="sampleAccountText"><strong>{profile?.full_name || user.email}</strong><small>{workspaceLoading ? "Checking access…" : membershipRole || "member"}</small></span></footer> : null}
    </div>
    <style jsx>{`
      .newChatNavigationVisualSample{position:fixed;inset:0 auto 0 0;z-index:49000;width:224px;height:100dvh;display:grid;grid-template-rows:auto auto minmax(0,1fr);background:linear-gradient(180deg,#030712,#040817);border-right:1px solid rgba(148,163,184,.1);overflow:hidden;color:#f8fafc}.sampleMenuBrand{display:flex;gap:10px;padding:16px 16px 10px}.sampleMenuBrand>span:last-child{display:grid}.sampleMenuBrand strong{font-size:12px;letter-spacing:.08em}.sampleMenuBrand small{font-size:8px;color:#8190aa}.sampleMenuOrb{width:29px;height:29px;border-radius:50%;display:grid;place-items:center;background:#071426;border:1px solid #163a6a}.sampleMenuOrb i{width:10px;height:10px;border-radius:50%;background:#2dd4ff;box-shadow:0 0 12px #2dd4ff}.sampleTopActions{display:flex;justify-content:flex-end;gap:5px;padding:0 12px 7px}.sampleTopActions button{width:30px;height:30px;display:grid;place-items:center;border:0;border-radius:8px;background:transparent;color:#aebbd0}.sampleMenuScroll{min-height:0;overflow-y:auto;padding:0 9px 14px;scrollbar-width:none}.sampleMenuScroll::-webkit-scrollbar{display:none}.sampleMenuGroup{display:grid;margin-bottom:10px}.sampleMenuGroup h2{margin:4px 8px;color:#65748d;font-size:7px;text-transform:uppercase;letter-spacing:.16em}.sampleMenuItem{width:100%;min-height:31px;display:flex;align-items:center;gap:9px;border:0;border-radius:7px;background:transparent;color:#aab5c8;text-align:left;padding:6px 9px;font-size:10px;font-weight:600;cursor:pointer}.sampleMenuItem:hover{background:rgba(59,130,246,.09);color:#fff}.sampleMenuItem.active{background:linear-gradient(90deg,rgba(29,110,224,.95),rgba(89,48,184,.9));color:#fff}.adminMenuGroup{padding-top:4px;border-top:1px solid rgba(148,163,184,.08)}.adminMenuItem{color:#7dd3fc}.sampleAccountSummary{display:flex;align-items:center;gap:9px;margin:9px 4px 0;padding:7px 5px}.sampleAvatar{width:25px;height:25px;display:grid;place-items:center;border-radius:50%;background:linear-gradient(135deg,#0ea5e9,#7c3aed);font-size:10px;font-weight:800}.sampleAccountText{display:grid;min-width:0}.sampleAccountText strong{overflow:hidden;text-overflow:ellipsis;font-size:9px}.sampleAccountText small{font-size:8px;color:#7f8ca3}.sampleTopActions button:hover{background:rgba(59,130,246,.12);color:#fff}@media(max-width:900px){.newChatNavigationVisualSample{display:none}}
    `}</style>
    <style jsx global>{`
      @media(min-width:901px){.withNewChatVisualSample{width:100%;min-width:0;overflow:hidden}.withNewChatVisualSample .streamsOperator,.withNewChatVisualSample .destinationPage{width:100vw!important;height:100dvh!important;padding-left:224px!important;box-sizing:border-box!important;overflow:hidden!important}.withNewChatVisualSample .streamsOperator{display:block!important}.withNewChatVisualSample .streamsOperator>.operatorSidebar{display:none!important}.withNewChatVisualSample .operatorMain{display:block!important;width:100%!important;height:100dvh!important;overflow:hidden!important}.withNewChatVisualSample .operatorChatPanel{width:100%!important;height:100%!important}.withNewChatVisualSample .operatorEmptyLanding{width:min(1120px,calc(100% - 64px))!important;margin-inline:auto!important}.withNewChatVisualSample .operatorLandingComposer{width:min(960px,100%)!important}}@media(max-width:900px){.withNewChatVisualSample .streamsOperator,.withNewChatVisualSample .destinationPage{padding-left:0!important}}
    `}</style>
  </aside>;
}
