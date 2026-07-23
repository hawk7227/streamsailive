"use client";

import {
  Bot,
  BriefcaseBusiness,
  Files,
  FolderKanban,
  Hammer,
  History,
  Home,
  Images,
  ListTodo,
  PanelsTopLeft,
  Plus,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { GLOBAL_NAVIGATION_ITEMS } from "./preservation-contract";
import { useProjectWorkspace } from "./ProjectWorkspaceController";

const ICONS: Record<string, LucideIcon> = {
  Home,
  Projects: FolderKanban,
  Workspace: PanelsTopLeft,
  Files,
  Create: Plus,
  Generate: Sparkles,
  Build: Hammer,
  Assets: Images,
  Tasks: ListTodo,
  History,
  "Ask AI": Bot,
  Settings,
};

export default function GlobalNavigationRail() {
  const { state, setGlobalNav, setTrayTab } = useProjectWorkspace();

  function activate(item: string) {
    setGlobalNav(item);

    if (item === "Home") {
      const url = new URL(window.location.href);
      url.searchParams.set("view", "chat");
      window.localStorage.setItem("streams-ai:experience-view", "chat");
      window.location.assign(url.toString());
      return;
    }
    if (item === "Files" || item === "Assets") setTrayTab("Assets");
    if (item === "Tasks") setTrayTab("Tasks");
    if (item === "History") setTrayTab("Versions");
    if (item === "Ask AI") {
      window.setTimeout(() => {
        const chat = document.querySelector<HTMLElement>(".builderChatFrame");
        chat?.scrollIntoView({ behavior: "smooth", block: "center" });
        chat?.querySelector<HTMLInputElement>(".footerComposer input")?.focus({ preventScroll: true });
      }, 40);
    }
    if (item === "Projects") {
      window.dispatchEvent(new CustomEvent("streams-ai:open-project-creation"));
    }
  }

  return (
    <nav className="globalNavigationRail" aria-label="StreamsAI global navigation">
      {GLOBAL_NAVIGATION_ITEMS.map((item) => {
        const Icon = ICONS[item] || BriefcaseBusiness;
        const active = state.activeGlobalNav === item;
        return (
          <button
            key={item}
            type="button"
            className={active ? "railItem active" : "railItem"}
            onClick={() => activate(item)}
            aria-current={active ? "page" : undefined}
            aria-label={item}
            title={item}
          >
            <span className="railIndicator" aria-hidden="true" />
            <Icon className="railIcon" size={19} strokeWidth={active ? 2.35 : 1.9} aria-hidden="true" />
            <small>{item}</small>
          </button>
        );
      })}
    </nav>
  );
}
