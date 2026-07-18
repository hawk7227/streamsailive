"use client";

import { GLOBAL_NAVIGATION_ITEMS } from "./preservation-contract";
import { useProjectWorkspace } from "./ProjectWorkspaceController";

export default function GlobalNavigationRail() {
  const { state, setGlobalNav } = useProjectWorkspace();

  return (
    <nav className="globalNavigationRail" aria-label="StreamsAI global navigation">
      {GLOBAL_NAVIGATION_ITEMS.map((item) => (
        <button
          key={item}
          type="button"
          className={state.activeGlobalNav === item ? "active" : ""}
          onClick={() => setGlobalNav(item)}
          aria-current={state.activeGlobalNav === item ? "page" : undefined}
          title={item}
        >
          <span aria-hidden="true">{item.slice(0, 1)}</span>
          <small>{item}</small>
        </button>
      ))}
    </nav>
  );
}
