"use client";

import { useProjectWorkspace } from "./ProjectWorkspaceController";

type NavItem = {
  label: string;
  glyph: string;
  action: string;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Home", glyph: "H", action: "Home" },
  { label: "Projects", glyph: "P", action: "Projects" },
  { label: "Workspace", glyph: "W", action: "Workspace" },
  { label: "Files", glyph: "F", action: "Files" },
  { label: "Create", glyph: "C", action: "Create" },
  { label: "Generate", glyph: "G", action: "Generate" },
  { label: "Build", glyph: "B", action: "Build" },
  { label: "Assets", glyph: "A", action: "Assets" },
  { label: "Tasks", glyph: "T", action: "Tasks" },
  { label: "History", glyph: "H", action: "History" },
  { label: "Ask AI", glyph: "A", action: "Ask AI" },
  { label: "Settings", glyph: "S", action: "Settings" },
];

const BUILDER_ITEMS = new Set(["Build", "Workspace"]);

export default function GlobalNavigationRail() {
  const { state, setGlobalNav, setTrayTab } = useProjectWorkspace();

  function openChat() {
    const url = new URL(window.location.href);
    url.searchParams.set("view", "chat");
    window.localStorage.setItem("streams-ai:experience-view", "chat");
    window.location.assign(url.toString());
  }

  function activate(item: NavItem) {
    setGlobalNav(item.action);

    if (item.action === "Home") {
      openChat();
      return;
    }
    if (item.action === "Projects") {
      window.dispatchEvent(new CustomEvent("streams-ai:open-project-creation"));
      return;
    }
    if (item.action === "Files" || item.action === "Assets") {
      setTrayTab("Assets");
      return;
    }
    if (item.action === "Tasks") {
      setTrayTab("Tasks");
      return;
    }
    if (item.action === "History") {
      setTrayTab("Versions");
      return;
    }
    if (item.action === "Ask AI") {
      window.setTimeout(() => {
        const chat = document.querySelector<HTMLElement>(".builderChatFrame");
        chat?.scrollIntoView({ behavior: "smooth", block: "center" });
        chat?.querySelector<HTMLInputElement>(".footerComposer input")?.focus({ preventScroll: true });
      }, 40);
      return;
    }
    if (BUILDER_ITEMS.has(item.action)) {
      window.dispatchEvent(new CustomEvent("streams-ai:workspace-menu-selected", { detail: { action: item.action } }));
      return;
    }
    window.dispatchEvent(new CustomEvent("streams-ai:product-menu-selected", { detail: { action: item.action } }));
  }

  function newSession() {
    try {
      window.sessionStorage.removeItem("streams-ai:active-session-id");
      window.localStorage.removeItem("streams-ai:active-session-id");
    } catch {}
    const url = new URL(window.location.origin + "/streams-ai");
    url.searchParams.set("view", "chat");
    window.location.assign(url.toString());
  }

  return (
    <nav className="globalNavigationRail" aria-label="StreamsAI global navigation">
      <button type="button" className="railBrand" aria-label="StreamsAI home" onClick={openChat}>S</button>
      <button type="button" className="railNew" aria-label="New session" title="New session" onClick={newSession}>+</button>
      <div className="railItems">
        {NAV_ITEMS.map((item) => {
          const active = state.activeGlobalNav === item.action;
          return (
            <button
              key={item.action}
              type="button"
              className={active ? "railItem active" : "railItem"}
              onClick={() => activate(item)}
              aria-current={active ? "page" : undefined}
              aria-label={item.label}
              title={item.label}
            >
              <span aria-hidden="true">{item.glyph}</span>
              <small>{item.label}</small>
            </button>
          );
        })}
      </div>
      <style jsx>{`
        .globalNavigationRail{width:72px;min-width:72px;height:100%;min-height:0;display:grid;grid-template-rows:auto auto minmax(0,1fr);gap:8px;padding:8px 6px;background:#050d19;border-right:1px solid rgba(148,163,184,.16);overflow:hidden;color:#f8fafc}
        .railBrand,.railNew,.railItem{border:0;cursor:pointer;color:#cbd5e1;background:transparent}
        .railBrand{width:40px;height:40px;justify-self:center;border:1px solid rgba(148,163,184,.28);border-radius:12px;background:#0f1a2d;font-size:15px;font-weight:900}
        .railNew{width:40px;height:40px;justify-self:center;border-radius:12px;background:#172554;color:#dbeafe;font-size:21px;font-weight:800}
        .railItems{min-height:0;overflow-y:auto;overflow-x:hidden;display:grid;align-content:start;gap:4px;padding-bottom:10px;scrollbar-width:none}
        .railItems::-webkit-scrollbar{display:none}
        .railItem{min-height:48px;border-radius:12px;display:grid;place-items:center;align-content:center;gap:2px;padding:5px 2px}
        .railItem span{font-size:15px;font-weight:900;line-height:1}
        .railItem small{font-size:8px;line-height:1.1;white-space:nowrap}
        .railItem:hover{background:#101832;color:#fff}
        .railItem.active{background:#172554;color:#bfdbfe;box-shadow:inset 0 0 0 1px rgba(96,165,250,.18)}
        @media(max-width:760px){.globalNavigationRail{width:58px;min-width:58px;padding-inline:4px}.railBrand,.railNew{width:38px;height:38px}.railItem{min-height:44px}.railItem small{display:none}}
      `}</style>
    </nav>
  );
}
