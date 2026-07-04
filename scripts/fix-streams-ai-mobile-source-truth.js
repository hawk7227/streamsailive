const fs = require("fs");
const path = require("path");

const root = process.cwd();

function file(rel) {
  return path.join(root, rel);
}

function read(rel) {
  return fs.readFileSync(file(rel), "utf8");
}

function write(rel, content) {
  fs.writeFileSync(file(rel), content, "utf8");
}

function replaceExact(rel, from, to, label) {
  const current = read(rel);
  if (!current.includes(from)) {
    throw new Error(`Missing exact block: ${label}\nFile: ${rel}`);
  }
  write(rel, current.replace(from, to));
  console.log(`✅ ${label}`);
}

function removeIfPresent(rel, text, label) {
  const current = read(rel);
  if (!current.includes(text)) {
    console.log(`⚠️ Already removed: ${label}`);
    return;
  }
  write(rel, current.replace(text, ""));
  console.log(`✅ ${label}`);
}

// 1) Remove bridge import + mount from /streams-ai/page.tsx
removeIfPresent(
  "src/app/streams-ai/page.tsx",
  `import StreamsAIMobileBuilderFeelBridge from "./StreamsAIMobileBuilderFeelBridge";\n`,
  "Removed bridge import"
);

removeIfPresent(
  "src/app/streams-ai/page.tsx",
  `      <StreamsAIMobileBuilderFeelBridge />\n`,
  "Removed bridge mount"
);

// 2) Delete bridge file
const bridgePath = file("src/app/streams-ai/StreamsAIMobileBuilderFeelBridge.jsx");
if (fs.existsSync(bridgePath)) {
  fs.unlinkSync(bridgePath);
  console.log("✅ Deleted StreamsAIMobileBuilderFeelBridge.jsx");
} else {
  console.log("⚠️ Bridge file already deleted");
}

// 3) Update StreamsOperatorShell.jsx directly
const shell = "src/components/streams-ai/visual-operator/StreamsOperatorShell.jsx";

// 3A) Remove visible MobileTop render from mobile ChatPanel
replaceExact(
  shell,
  `{isMobile ? <MobileTop onMenu={onMenu} activeProject={activeProject} onOpenInline={onOpenInline}/> : <div className="microbar">`,
  `{!isMobile ? <div className="microbar">`,
  "Mobile ChatPanel no longer renders visible MobileTop"
);

replaceExact(
  shell,
  `</small><button type="button" disabled={!activeProject} onClick={onOpenInline}>Inline Build</button></div></div>}<div className="chatScroll">`,
  `</small><button type="button" disabled={!activeProject} onClick={onOpenInline}>Inline Build</button></div></div> : null}<div className="chatScroll">`,
  "Desktop microbar conditional closes correctly"
);

// 3B) Replace MobileBottomNav with source-truth direct React version
replaceExact(
  shell,
  `function MobileBottomNav({ activeSection, setActiveSection }) { return <nav className="mobileNav">{MOBILE_TABS.map(([id, label]) => <button key={id} type="button" className={activeSection === id ? "active" : ""} onClick={() => setActiveSection(id)}>{label}</button>)}</nav>; }`,
  `function MobileBottomNav({ activeSection, setActiveSection, onMenu, activeProject, onOpenInline }) { const [moreOpen,setMoreOpen]=useState(false); return <><nav className="mobileNav"><button type="button" onClick={() => { setMoreOpen(false); onMenu?.(); }}>Menu</button><button type="button" className={activeSection === "home" ? "active" : ""} onClick={() => { setMoreOpen(false); setActiveSection("home"); }}>Home</button><button type="button" className={activeSection === "portfolio" ? "active" : ""} onClick={() => { setMoreOpen(false); setActiveSection("portfolio"); }}>Portfolio</button><button type="button" className={activeSection === "create" ? "active" : ""} onClick={() => { setMoreOpen(false); setActiveSection("create"); }}>Create</button><button type="button" className={moreOpen ? "active" : ""} onClick={() => setMoreOpen((value)=>!value)}>More</button></nav>{moreOpen ? <div className="mobileMoreMenu"><button type="button" disabled={!activeProject} onClick={() => { if (!activeProject) return; setMoreOpen(false); onOpenInline?.(); }}>Build</button><button type="button" onClick={() => { setMoreOpen(false); setActiveSection("preview-launch"); }}>Launch</button><button type="button" onClick={() => { setMoreOpen(false); setActiveSection("profile"); }}>Profile</button></div> : null}</>; }`,
  "MobileBottomNav is direct React Menu | Home | Portfolio | Create | More"
);

// 3C) Pass real props into MobileBottomNav
replaceExact(
  shell,
  `<MobileBottomNav activeSection={activeSection} setActiveSection={setActiveSection}/>`,
  `<MobileBottomNav activeSection={activeSection} setActiveSection={setActiveSection} onMenu={() => setDrawerOpen(true)} activeProject={activeProject} onOpenInline={() => activeProject && setInlineOpen(true)}/>`,
  "MobileBottomNav render call passes onMenu activeProject onOpenInline"
);

// 4) Add .chatScroll to runtime scroll helper
replaceExact(
  "src/components/streams-ai/current-chat/new-face/hooks/useStreamsChatRuntime.js",
  `    const splitSurface = document.querySelector(".splitChatScroll");
    if (splitSurface) splitSurface.scrollTo({ top: splitSurface.scrollHeight, behavior: "smooth" });`,
  `    const chatScroll = document.querySelector(".chatScroll");
    if (chatScroll) {
      chatScroll.scrollTo({ top: chatScroll.scrollHeight, behavior: "smooth" });
      return;
    }
    const splitSurface = document.querySelector(".splitChatScroll");
    if (splitSurface) splitSurface.scrollTo({ top: splitSurface.scrollHeight, behavior: "smooth" });`,
  "Added .chatScroll to scrollActiveChatToBottom"
);

console.log("\\n✅ Missing source-truth exact items patched.");
