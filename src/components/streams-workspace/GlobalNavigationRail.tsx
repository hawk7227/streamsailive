"use client";

import { useProjectWorkspace } from "./ProjectWorkspaceController";

type MenuItem = {
  label: string;
  action?: string;
  href?: string;
};

type MenuGroup = {
  label: string;
  items: MenuItem[];
};

const MENU_GROUPS: MenuGroup[] = [
  {
    label: "Main",
    items: [
      { label: "Home", action: "Home" },
      { label: "Portfolio", action: "Portfolio" },
      { label: "Projects", action: "Projects" },
      { label: "Workspace", action: "Workspace" },
      { label: "Files", action: "Files" },
      { label: "Create", action: "Create" },
      { label: "Generate", action: "Generate" },
      { label: "Build", action: "Build" },
    ],
  },
  {
    label: "Build",
    items: [
      { label: "Business Builder", action: "Business Builder" },
      { label: "Revenue", action: "Revenue" },
      { label: "Visual Concepts", action: "Visual Concepts" },
      { label: "Website Builder", action: "Website Builder" },
      { label: "App Builder", action: "App Builder" },
      { label: "Preview + Launch", action: "Preview + Launch" },
    ],
  },
  {
    label: "Create",
    items: [
      { label: "Creator Studio", action: "Creator Studio" },
      { label: "Image Studio", action: "Image Studio" },
      { label: "Video Studio", action: "Video Studio" },
      { label: "Voice Studio", action: "Voice Studio" },
      { label: "Captions", action: "Captions" },
      { label: "Content", action: "Content" },
      { label: "Ideas", action: "Ideas" },
      { label: "Turn This Into You", action: "Turn This Into You" },
      { label: "Calendar", action: "Calendar" },
      { label: "Social Research", action: "Social Research" },
    ],
  },
  {
    label: "Project Tools",
    items: [
      { label: "Assets", action: "Assets" },
      { label: "Tasks", action: "Tasks" },
      { label: "History", action: "History" },
      { label: "Ask AI", action: "Ask AI" },
      { label: "Settings", action: "Settings" },
    ],
  },
];

const BUILDER_ITEMS = new Set([
  "Build",
  "Business Builder",
  "Visual Concepts",
  "Website Builder",
  "App Builder",
  "Preview + Launch",
  "Workspace",
]);

export default function GlobalNavigationRail() {
  const { state, setGlobalNav, setTrayTab } = useProjectWorkspace();

  function openChat() {
    const url = new URL(window.location.href);
    url.searchParams.set("view", "chat");
    window.localStorage.setItem("streams-ai:experience-view", "chat");
    window.location.assign(url.toString());
  }

  function activate(item: MenuItem) {
    const action = item.action || item.label;
    setGlobalNav(action);

    if (item.href) {
      window.location.assign(item.href);
      return;
    }
    if (action === "Home") {
      openChat();
      return;
    }
    if (action === "Projects") {
      window.dispatchEvent(new CustomEvent("streams-ai:open-project-creation"));
      return;
    }
    if (action === "Files" || action === "Assets") {
      setTrayTab("Assets");
      return;
    }
    if (action === "Tasks") {
      setTrayTab("Tasks");
      return;
    }
    if (action === "History") {
      setTrayTab("Versions");
      return;
    }
    if (action === "Ask AI") {
      window.setTimeout(() => {
        const chat = document.querySelector<HTMLElement>(".builderChatFrame");
        chat?.scrollIntoView({ behavior: "smooth", block: "center" });
        chat?.querySelector<HTMLInputElement>(".footerComposer input")?.focus({ preventScroll: true });
      }, 40);
      return;
    }
    if (BUILDER_ITEMS.has(action)) {
      window.dispatchEvent(new CustomEvent("streams-ai:workspace-menu-selected", { detail: { action } }));
      return;
    }
    window.dispatchEvent(new CustomEvent("streams-ai:product-menu-selected", { detail: { action } }));
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
    <nav className="globalNavigationRail streamsProductMenu" aria-label="StreamsAI global navigation">
      <header className="streamsMenuBrand">
        <span className="streamsMenuOrb" aria-hidden="true"><i /></span>
        <span><strong>STREAMS AI</strong><small>Your AI Business Operator</small></span>
      </header>
      <button type="button" className="newSessionButton" onClick={newSession}>+ New session</button>
      <div className="streamsMenuScroll">
        {MENU_GROUPS.map((group) => (
          <section className="streamsMenuGroup" key={group.label} aria-label={group.label}>
            <h2>{group.label}</h2>
            {group.items.map((item) => {
              const action = item.action || item.label;
              const active = state.activeGlobalNav === action || (state.activeGlobalNav === "Build" && action === "Business Builder");
              return (
                <button
                  key={`${group.label}:${item.label}`}
                  type="button"
                  className={active ? "streamsMenuItem active" : "streamsMenuItem"}
                  onClick={() => activate(item)}
                  aria-current={active ? "page" : undefined}
                  aria-label={item.label}
                  title={item.label}
                >
                  {item.label}
                </button>
              );
            })}
          </section>
        ))}
      </div>
      <style jsx>{`
        .streamsProductMenu{width:232px;min-width:232px;height:100%;min-height:0;display:grid;grid-template-rows:auto auto minmax(0,1fr);background:#050719;border-right:1px solid rgba(148,163,184,.12);overflow:hidden;color:#f8fafc}
        .streamsMenuBrand{display:flex;align-items:center;gap:10px;padding:13px 12px 9px}.streamsMenuBrand>span:last-child{display:grid;gap:2px}.streamsMenuBrand strong{font-size:13px;letter-spacing:.1em}.streamsMenuBrand small{font-size:9px;color:#93a4bf}.streamsMenuOrb{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#071426;border:1px solid #163a6a;box-shadow:0 0 18px rgba(37,99,235,.2)}.streamsMenuOrb i{width:11px;height:11px;border-radius:50%;background:#2dd4ff;box-shadow:0 0 12px #2dd4ff}
        .newSessionButton{margin:0 8px 10px;height:38px;border:0;border-radius:10px;background:linear-gradient(90deg,#28d7ff,#6d5cff);color:#031021;font-size:13px;font-weight:900;cursor:pointer}
        .streamsMenuScroll{min-height:0;overflow-y:auto;overflow-x:hidden;padding:0 6px 18px;scrollbar-width:thin;scrollbar-color:#4b5563 transparent}.streamsMenuGroup{display:grid;gap:2px;margin-bottom:12px}.streamsMenuGroup h2{margin:4px 7px 3px;color:#7890bc;font-size:8px;line-height:1.2;text-transform:uppercase;letter-spacing:.16em}.streamsMenuItem{width:100%;min-height:31px;border:0;border-radius:8px;background:transparent;color:#edf2ff;text-align:left;padding:6px 10px;font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap}.streamsMenuItem:hover{background:#101832}.streamsMenuItem.active{background:linear-gradient(90deg,#5933b9,#174ab6);color:#fff;box-shadow:inset 0 0 0 1px rgba(125,211,252,.12)}
        @media(max-width:760px){.streamsProductMenu{width:190px;min-width:190px}.streamsMenuBrand{padding-inline:9px}.streamsMenuItem{font-size:11px;padding-inline:8px}}
      `}</style>
    </nav>
  );
}
