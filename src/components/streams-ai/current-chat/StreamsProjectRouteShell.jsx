"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import StreamsClientShell from "./StreamsClientShell";

export default function StreamsProjectRouteShell({ mode, title, description }) {
  const router = useRouter();

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("streams-ai:project-route-context", {
      detail: {
        mode,
        title,
        description,
        route: window.location.pathname,
        source: "dedicated-project-route",
      },
    }));
  }, [mode, title, description]);

  return (
    <main className="streamsProjectRoute" data-project-mode={mode}>
      <header className="projectRouteHeader">
        <div>
          <strong>{title}</strong>
          <span>{description}</span>
        </div>
        <nav aria-label={`${title} navigation`}>
          <button type="button" onClick={() => router.push("/streams-ai")}>Chat</button>
          <button type="button" onClick={() => router.push("/streams-ai/streams-builder")}>Builder</button>
          <button type="button" onClick={() => router.push("/streams-ai/streams-builder/workspace")}>Workspace</button>
        </nav>
      </header>
      <section className="projectRouteBody" aria-label={title}>
        <StreamsClientShell />
      </section>
      <style jsx>{`
        .streamsProjectRoute{height:100dvh;min-height:100dvh;display:grid;grid-template-rows:56px minmax(0,1fr);overflow:hidden;background:#020713;color:#fff}
        .projectRouteHeader{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:8px 14px;border-bottom:1px solid rgba(148,163,184,.2);background:#07101f;position:relative;z-index:20000}
        .projectRouteHeader>div{display:grid;gap:2px;min-width:0}.projectRouteHeader strong{font-size:14px}.projectRouteHeader span{font-size:10px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        nav{display:flex;align-items:center;gap:8px}button{height:34px;border:1px solid rgba(148,163,184,.28);border-radius:9px;background:#0f1a2d;color:#dbeafe;font-size:11px;font-weight:800;padding:0 12px;cursor:pointer}
        .projectRouteBody{min-height:0;overflow:hidden;position:relative}
        @media(max-width:720px){.projectRouteHeader span{display:none}.projectRouteHeader nav button:nth-child(2){display:none}}
      `}</style>
    </main>
  );
}
