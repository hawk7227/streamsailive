"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

type DockTab = "preview" | "editor" | "studio";

const TABS: Record<DockTab, { label: string; src: string }> = {
  preview: { label: "Preview", src: "/preview" },
  editor: { label: "Editor", src: "/editor" },
  studio: { label: "Studio", src: "/studio-pro-test" },
};

export function ChatEditorDock() {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<DockTab>("preview");

  if (!pathname?.startsWith("/streams-ai")) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-[9999] rounded-full border border-black/10 bg-black px-5 py-3 text-sm font-semibold text-white shadow-2xl"
      >
        Open Preview / Editor
      </button>
    );
  }

  return (
    <aside className="fixed bottom-6 right-6 top-24 z-[9999] flex w-[min(760px,calc(100vw-32px))] flex-col overflow-hidden rounded-3xl border border-black/10 bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-black/10 bg-white px-4 py-3">
        <div>
          <div className="text-sm font-bold text-black">Live Preview + Editor</div>
          <div className="text-xs text-black/55">Mounted into Streams AI chat</div>
        </div>

        <div className="flex items-center gap-2">
          {(Object.keys(TABS) as DockTab[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={[
                "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                tab === key ? "bg-black text-white" : "bg-black/5 text-black hover:bg-black/10",
              ].join(" ")}
            >
              {TABS[key].label}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-full bg-black/5 px-3 py-1.5 text-xs font-semibold text-black hover:bg-black/10"
          >
            Hide
          </button>
        </div>
      </div>

      <iframe
        key={tab}
        title={`Streams AI ${TABS[tab].label}`}
        src={TABS[tab].src}
        className="h-full w-full flex-1 bg-white"
      />
    </aside>
  );
}
