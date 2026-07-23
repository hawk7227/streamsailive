"use client";

const GROUPS = [
  { label: "Main", items: ["Home", "Portfolio", "Projects", "Workspace", "Files", "Create", "Generate", "Build"] },
  { label: "Build", items: ["Business Builder", "Revenue", "Visual Concepts", "Website Builder", "App Builder", "Preview + Launch"] },
  { label: "Create", items: ["Creator Studio", "Image Studio", "Video Studio", "Voice Studio", "Captions", "Content", "Ideas", "Turn This Into You", "Calendar", "Social Research"] },
  { label: "Project Tools", items: ["Assets", "Tasks", "History", "Ask AI", "Settings"] },
];

export default function NewChatNavigationVisualSample({ onNewProject }) {
  return (
    <aside className="newChatNavigationVisualSample" aria-label="StreamsAI navigation visual sample" data-hardcoded-visual-sample="true">
      <header className="sampleMenuBrand">
        <span className="sampleMenuOrb" aria-hidden="true"><i /></span>
        <span><strong>STREAMS AI</strong><small>Your AI Business Operator</small></span>
      </header>
      <button type="button" className="sampleNewSession" onClick={onNewProject}>+ New project</button>
      <div className="sampleMenuScroll">
        {GROUPS.map((group) => (
          <section className="sampleMenuGroup" key={group.label} aria-label={group.label}>
            <h2>{group.label}</h2>
            {group.items.map((item) => (
              <button key={`${group.label}:${item}`} type="button" className={item === "Home" ? "sampleMenuItem active" : "sampleMenuItem"} tabIndex={-1}>
                {item}
              </button>
            ))}
          </section>
        ))}
      </div>
      <style jsx>{`
        .newChatNavigationVisualSample{position:fixed;inset:0 auto 0 0;z-index:49000;width:232px;min-width:232px;height:100dvh;display:grid;grid-template-rows:auto auto minmax(0,1fr);background:#050719;border-right:1px solid rgba(148,163,184,.12);overflow:hidden;color:#f8fafc;opacity:0;transform:translateX(-18px);animation:newChatMenuFadeIn 3.2s cubic-bezier(.16,1,.3,1) .35s forwards;box-shadow:16px 0 48px rgba(0,0,0,.22)}
        .sampleMenuBrand{display:flex;align-items:center;gap:10px;padding:13px 12px 9px}.sampleMenuBrand>span:last-child{display:grid;gap:2px}.sampleMenuBrand strong{font-size:13px;letter-spacing:.1em}.sampleMenuBrand small{font-size:9px;color:#93a4bf}.sampleMenuOrb{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#071426;border:1px solid #163a6a;box-shadow:0 0 18px rgba(37,99,235,.2)}.sampleMenuOrb i{width:11px;height:11px;border-radius:50%;background:#2dd4ff;box-shadow:0 0 12px #2dd4ff}
        .sampleNewSession{margin:0 8px 10px;height:38px;border:0;border-radius:10px;background:linear-gradient(90deg,#28d7ff,#6d5cff);color:#031021;font-size:13px;font-weight:900;cursor:pointer}
        .sampleMenuScroll{min-height:0;overflow-y:auto;overflow-x:hidden;padding:0 6px 18px;scrollbar-width:thin;scrollbar-color:#4b5563 transparent}.sampleMenuGroup{display:grid;gap:2px;margin-bottom:12px}.sampleMenuGroup h2{margin:4px 7px 3px;color:#7890bc;font-size:8px;line-height:1.2;text-transform:uppercase;letter-spacing:.16em}.sampleMenuItem{width:100%;min-height:31px;border:0;border-radius:8px;background:transparent;color:#edf2ff;text-align:left;padding:6px 10px;font-size:12px;font-weight:800;white-space:nowrap;pointer-events:none}.sampleMenuItem.active{background:linear-gradient(90deg,#5933b9,#174ab6);color:#fff;box-shadow:inset 0 0 0 1px rgba(125,211,252,.12)}
        @keyframes newChatMenuFadeIn{0%{opacity:0;transform:translateX(-18px);filter:blur(4px)}45%{opacity:.58;filter:blur(1px)}100%{opacity:1;transform:translateX(0);filter:blur(0)}}
        @media(prefers-reduced-motion:reduce){.newChatNavigationVisualSample{animation:none;opacity:1;transform:none;filter:none}}
        @media(max-width:760px){.newChatNavigationVisualSample{width:190px;min-width:190px}.sampleMenuBrand{padding-inline:9px}.sampleMenuItem{font-size:11px;padding-inline:8px}}
      `}</style>
    </aside>
  );
}
