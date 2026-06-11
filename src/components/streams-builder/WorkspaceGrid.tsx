"use client";

import { type CSSProperties, useMemo, useState } from "react";

type WorkspaceKey =
  | "primary-builder"
  | "visual-editing"
  | "component-mapping"
  | "approval-center"
  | "browser-verification"
  | "repository-truth"
  | "projects-dashboard"
  | "truth-panel";

type SourceTruth = { route: string; component: string; file: string; github: string };

type WorkspaceConfig = SourceTruth & {
  key: WorkspaceKey;
  number: string;
  title: string;
  subtitle: string;
  chat: string[];
  status: string;
  previewTitle: string;
  previewSubtitle: string;
  bottom: { review: string; recent: string[]; components: string[]; truth: string[]; comments: string[] };
  notifications: Array<{ title: string; project: string; summary: string; route: string; component: string; file: string; status: string }>;
};

type EditableElementType = "text" | "button" | "card" | "artifact";

type EditableElement = SourceTruth & {
  id: string;
  type: EditableElementType;
  label: string;
  text: string;
  artifactUrl?: string;
  artifactKind?: "image" | "video" | "document" | "none";
  style: {
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    color: string;
    background: string;
    width: number;
    height: number;
    padding: number;
    marginTop: number;
    borderRadius: number;
    letterSpacing: number;
    lineHeight: number;
    align: "left" | "center" | "right";
  };
};

const baseNotifications = (source: SourceTruth, title: string, status: string) => [
  {
    title,
    project: "Streams Builder",
    summary: `${source.component} is active in the current workspace.`,
    route: source.route,
    component: source.component,
    file: source.file,
    status,
  },
];

const workspaceConfigs: WorkspaceConfig[] = [
  {
    key: "primary-builder",
    number: "1",
    title: "Primary Builder",
    subtitle: "Build. Preview. Prove.",
    chat: ["Primary Builder is ready.", "Source Truth is locked to PricingSection.", "Use this workspace to build, validate, save, rollback, and approve."],
    status: "Ready for build execution.",
    previewTitle: "Build Better.",
    previewSubtitle: "Ship Faster.",
    route: "/pricing",
    component: "PricingSection",
    file: "src/components/pricing/PricingSection.tsx",
    github: "src/components/pricing/PricingSection.tsx",
    bottom: {
      review: "PricingSection preview",
      recent: ["PricingSection.tsx +45", "FeatureGrid.tsx +36", "styles/pricing.css +27"],
      components: ["Pricing Section", "Plan Card", "Popular Badge"],
      truth: ["Route /pricing VERIFIED", "Component PricingSection VERIFIED", "Proof READY"],
      comments: ["Make Enterprise stand out.", "Updating pricing design.", "Run full proof."],
    },
    notifications: baseNotifications(
      { route: "/pricing", component: "PricingSection", file: "src/components/pricing/PricingSection.tsx", github: "src/components/pricing/PricingSection.tsx" },
      "Ready For Approval",
      "Ready",
    ),
  },
  {
    key: "visual-editing",
    number: "2",
    title: "Visual Editing",
    subtitle: "Drag. Drop. Style.",
    chat: ["Visual Editing is active.", "Click any element in the front view.", "Edit text, font, color, spacing, resizing, artifact data, source truth, and patch preview."],
    status: "Visual editing canvas active.",
    previewTitle: "Visual Edit Mode",
    previewSubtitle: "Click. Edit. Patch.",
    route: "/visual-editing",
    component: "VisualEditingPanel",
    file: "src/components/streams-builder/VisualEditingPanel.tsx",
    github: "src/components/streams-builder/VisualEditingPanel.tsx",
    bottom: {
      review: "Editable visual canvas",
      recent: ["Hero title editable", "CTA editable", "Artifact controls available"],
      components: ["Editable Canvas", "Style Inspector", "Patch Preview"],
      truth: ["Selected element required", "Source owner visible", "Patch preview generated"],
      comments: ["Click an element.", "Edit it in the inspector.", "Save Patch when ready."],
    },
    notifications: baseNotifications(
      { route: "/visual-editing", component: "VisualEditingPanel", file: "src/components/streams-builder/VisualEditingPanel.tsx", github: "src/components/streams-builder/VisualEditingPanel.tsx" },
      "Visual Editor Ready",
      "Ready",
    ),
  },
  ...[
    ["component-mapping", "3", "Component Mapping", "Map. Bind. Connect.", "/component-map", "ComponentMap"],
    ["approval-center", "4", "Approval Center", "Review. Approve. Ship.", "/approval", "ApprovalCenter"],
    ["browser-verification", "5", "Browser Verification", "Test. Verify. Validate.", "/browser-proof", "BrowserVerification"],
    ["repository-truth", "6", "Repository Truth", "Truth. Diff. History.", "/repo-truth", "RepositoryTruth"],
    ["projects-dashboard", "7", "Projects Dashboard", "Overview. Track. Report.", "/projects", "ProjectsDashboard"],
    ["truth-panel", "T", "Truth Panel", "Proven. Verified. Trusted.", "/truth-panel", "TruthPanel"],
  ].map(([key, number, title, subtitle, route, component]) => {
    const file = `src/components/streams-builder/${component}.tsx`;
    const source = { route, component, file, github: file };
    return {
      key: key as WorkspaceKey,
      number,
      title,
      subtitle,
      chat: [`${title} is active.`, `Current component is ${component}.`, "This workspace changes preview, bottom cards, notifications, and source truth."],
      status: `${title} workspace active.`,
      previewTitle: title,
      previewSubtitle: subtitle,
      ...source,
      bottom: {
        review: `${component} preview`,
        recent: [`${component}.tsx selected`, "Workspace state synced", "Source truth visible"],
        components: [component, "WorkspaceGrid", "StreamsBuilderSystemShell"],
        truth: [`Route ${route}`, `Component ${component}`, "Proof pending"],
        comments: ["Replace placeholders with real API data.", "Keep source truth synced.", "Do not guess ownership."],
      },
      notifications: baseNotifications(source, `${title} Active`, "Active"),
    };
  }),
];

const defaultEditableElements: EditableElement[] = [
  {
    id: "hero-title",
    type: "text",
    label: "Hero Title",
    text: "Build Better. Ship Faster.",
    route: "/visual-editing",
    component: "HeroHeadline",
    file: "src/components/streams-builder/visual/HeroHeadline.tsx",
    github: "src/components/streams-builder/visual/HeroHeadline.tsx",
    artifactKind: "none",
    style: { fontFamily: "Inter", fontSize: 42, fontWeight: 700, color: "#f8fafc", background: "transparent", width: 620, height: 88, padding: 8, marginTop: 18, borderRadius: 12, letterSpacing: -1, lineHeight: 1.05, align: "center" },
  },
  {
    id: "hero-copy",
    type: "text",
    label: "Hero Copy",
    text: "The intelligent workspace for building, editing, proving, and shipping real software.",
    route: "/visual-editing",
    component: "HeroCopy",
    file: "src/components/streams-builder/visual/HeroCopy.tsx",
    github: "src/components/streams-builder/visual/HeroCopy.tsx",
    artifactKind: "none",
    style: { fontFamily: "Inter", fontSize: 13, fontWeight: 500, color: "#cbd5e1", background: "transparent", width: 600, height: 44, padding: 6, marginTop: 8, borderRadius: 10, letterSpacing: 0, lineHeight: 1.35, align: "center" },
  },
  {
    id: "primary-cta",
    type: "button",
    label: "Primary CTA",
    text: "Start Editing",
    route: "/visual-editing",
    component: "PrimaryAction",
    file: "src/components/streams-builder/visual/PrimaryAction.tsx",
    github: "src/components/streams-builder/visual/PrimaryAction.tsx",
    artifactKind: "none",
    style: { fontFamily: "Inter", fontSize: 12, fontWeight: 800, color: "#ffffff", background: "#7c3aed", width: 150, height: 38, padding: 8, marginTop: 14, borderRadius: 10, letterSpacing: 0, lineHeight: 1, align: "center" },
  },
  {
    id: "feature-card",
    type: "card",
    label: "Feature Card",
    text: "Editable card: change copy, spacing, size, background, radius, and typography.",
    route: "/visual-editing",
    component: "EditableFeatureCard",
    file: "src/components/streams-builder/visual/EditableFeatureCard.tsx",
    github: "src/components/streams-builder/visual/EditableFeatureCard.tsx",
    artifactKind: "none",
    style: { fontFamily: "Inter", fontSize: 12, fontWeight: 600, color: "#e2e8f0", background: "#111827", width: 245, height: 118, padding: 16, marginTop: 24, borderRadius: 16, letterSpacing: 0, lineHeight: 1.35, align: "left" },
  },
  {
    id: "artifact-card",
    type: "artifact",
    label: "Artifact / Media",
    text: "Drop artifact link or describe media source.",
    route: "/visual-editing",
    component: "ArtifactCard",
    file: "src/components/streams-builder/visual/ArtifactCard.tsx",
    github: "src/components/streams-builder/visual/ArtifactCard.tsx",
    artifactKind: "image",
    artifactUrl: "https://streams-builder.preview.app/artifacts/hero-preview.png",
    style: { fontFamily: "Inter", fontSize: 11, fontWeight: 700, color: "#dbeafe", background: "#172554", width: 245, height: 118, padding: 16, marginTop: 24, borderRadius: 16, letterSpacing: 0, lineHeight: 1.35, align: "left" },
  },
];

export default function WorkspaceGrid() {
  const [selectedKey, setSelectedKey] = useState<WorkspaceKey>("primary-builder");
  const [editableElements, setEditableElements] = useState<EditableElement[]>(defaultEditableElements);
  const [selectedElementId, setSelectedElementId] = useState(defaultEditableElements[0].id);

  const selectedWorkspace = useMemo(() => workspaceConfigs.find((workspace) => workspace.key === selectedKey) ?? workspaceConfigs[0], [selectedKey]);
  const selectedElement = useMemo(() => editableElements.find((element) => element.id === selectedElementId) ?? editableElements[0], [editableElements, selectedElementId]);

  const effectiveSource: SourceTruth = selectedKey === "visual-editing" && selectedElement ? selectedElement : selectedWorkspace;

  function updateSelectedElement(patch: Partial<EditableElement>) {
    setEditableElements((current) =>
      current.map((element) =>
        element.id === selectedElementId
          ? { ...element, ...patch, style: patch.style ? { ...element.style, ...patch.style } : element.style }
          : element,
      ),
    );
  }

  function updateSelectedStyle(stylePatch: Partial<EditableElement["style"]>) {
    updateSelectedElement({ style: { ...selectedElement.style, ...stylePatch } });
  }

  function duplicateSelectedElement() {
    const next: EditableElement = {
      ...selectedElement,
      id: `${selectedElement.id}-${Date.now()}`,
      label: `${selectedElement.label} Copy`,
      text: `${selectedElement.text} Copy`,
    };
    setEditableElements((current) => [...current, next]);
    setSelectedElementId(next.id);
  }

  function resetVisualEditor() {
    setEditableElements(defaultEditableElements);
    setSelectedElementId(defaultEditableElements[0].id);
  }

  const visualMode = selectedKey === "visual-editing";

  return (
    <main className="workspace">
      <aside className="sidebar sb-panel">
        <small>WORKSPACES</small>
        {workspaceConfigs.map((item) => (
          <button type="button" className={`side-item ${item.key === selectedKey ? "active" : ""}`} key={item.key} onClick={() => setSelectedKey(item.key)}>
            <span>{item.number}</span>
            <div><b>{item.title}</b><p>{item.subtitle}</p></div>
          </button>
        ))}
        <button className="new-project" type="button">＋ New Project</button>
      </aside>

      <section className={`main-area ${visualMode ? "visual-mode" : ""}`}>
        <section className="chat sb-panel">
          <h3>AI BUILD CHAT</h3>
          {selectedWorkspace.chat.map((message, index) => <div className={`msg ${index === 1 ? "user" : ""}`} key={message}>{message}</div>)}
          {visualMode ? <div className="msg selected-msg">Selected: <b>{selectedElement.label}</b><br />File: {selectedElement.file}</div> : null}
          <div className="status">◆ {selectedWorkspace.status}</div>
          <div className="composer">Describe what you want to build...<button type="button">➤</button></div>
        </section>

        <section className="preview sb-panel">
          <div className="preview-head">
            <h3>{visualMode ? "VISUAL EDITOR" : "LIVE PREVIEW"}</h3>
            <div className="preview-search">⌕ Search projects, components, builds, files...</div>
            <div className="preview-actions">
              <span>Active Branch</span>
              <button className="sb-btn" type="button">main⌄</button>
              {visualMode ? (
                <>
                  <button className="sb-btn primary" type="button">Save Patch</button>
                  <button className="sb-btn" type="button" onClick={duplicateSelectedElement}>Duplicate</button>
                  <button className="sb-btn red" type="button" onClick={resetVisualEditor}>Reset</button>
                </>
              ) : (
                <>
                  <button className="sb-btn primary" type="button">Deploy Build</button>
                  <button className="sb-btn" type="button">Invite</button>
                </>
              )}
              <span className="bell">🔔</span>
              <div className="mini-avatar">A</div>
              <div className="mini-user"><b>Alex Morgan</b><small>Build Architect</small></div>
              <span className="device-icons">▣ ▯ ▯</span>
            </div>
          </div>

          <div className="url">🔒 https://streams-builder.preview.app{effectiveSource.route} ↻</div>

          {visualMode ? (
            <VisualEditingWorkspace
              elements={editableElements}
              selectedElement={selectedElement}
              selectedElementId={selectedElementId}
              setSelectedElementId={setSelectedElementId}
              updateSelectedElement={updateSelectedElement}
              updateSelectedStyle={updateSelectedStyle}
              duplicateSelectedElement={duplicateSelectedElement}
              resetVisualEditor={resetVisualEditor}
            />
          ) : <DefaultWorkspacePreview selected={selectedWorkspace} />}

          <SourceStrip source={effectiveSource} />
        </section>

        {!visualMode ? (
          <>
            <MiniReview value={selectedWorkspace.bottom.review} />
            <BottomList title="RECENT FILE CHANGES" items={selectedWorkspace.bottom.recent} />
            <BottomList title="COMPONENTS UPDATED" items={selectedWorkspace.bottom.components} />
            <BottomList title="TRUTH SUMMARY" items={selectedWorkspace.bottom.truth} />
            <BottomList title="COMMENTS THREAD" items={selectedWorkspace.bottom.comments} />
          </>
        ) : null}
      </section>

      {visualMode ? (
        <VisualEditorRightRail
          selectedElement={selectedElement}
          updateSelectedElement={updateSelectedElement}
          updateSelectedStyle={updateSelectedStyle}
          duplicateSelectedElement={duplicateSelectedElement}
          resetVisualEditor={resetVisualEditor}
        />
      ) : <ProjectNotificationCenter selected={selectedWorkspace} />}

      <style jsx>{`
        .workspace{height:100%;min-height:0;display:grid;grid-template-columns:190px minmax(0,1fr) 300px;gap:8px;overflow:hidden}
        .sidebar{padding:8px;overflow-y:auto;min-height:0;scrollbar-width:thin}.sidebar small{color:#94a3b8;font-size:10px;font-weight:700}
        .side-item{width:100%;height:42px;min-height:42px;display:flex;align-items:center;gap:8px;padding:6px;border-radius:10px;background:rgba(15,23,42,.72);border:1px solid rgba(148,163,184,.08);margin-top:7px;overflow:hidden;color:#fff;cursor:pointer;text-align:left}
        .side-item.active{background:linear-gradient(135deg,rgba(124,58,237,.78),rgba(76,29,149,.62));border-color:rgba(139,92,246,.7)}.side-item span{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;background:rgba(255,255,255,.08);font-size:14px;flex:0 0 28px}
        .side-item b{display:block;font-size:10px;line-height:1.1}.side-item p{margin:1px 0 0;color:#94a3b8;font-size:8px;line-height:1.1}.new-project{margin-top:8px;width:100%;height:30px;border-radius:8px;border:1px solid rgba(148,163,184,.12);background:rgba(15,23,42,.9);color:#fff;cursor:pointer}
        .main-area{min-width:0;min-height:0;display:grid;grid-template-columns:185px repeat(5,minmax(0,1fr));grid-template-rows:minmax(0,1fr) 96px;gap:8px;overflow:hidden}.main-area.visual-mode{grid-template-rows:minmax(0,1fr)}
        .chat{grid-row:1;grid-column:1;padding:8px;overflow:hidden}.preview{grid-row:1;grid-column:2/7;padding:4px;overflow:hidden;min-width:0}.main-area.visual-mode .preview{grid-row:1;grid-column:2/7}
        h3{margin:0 0 8px;font-size:10px;letter-spacing:.02em}.msg{margin:8px;padding:10px;border-radius:10px;background:rgba(30,41,59,.78);font-size:10px;line-height:1.45;color:#e2e8f0}.msg.user{background:linear-gradient(135deg,#5b21b6,#7c3aed)}.selected-msg{border:1px solid rgba(139,92,246,.55)}
        .status,.composer{margin-top:8px;padding:8px;border-radius:8px;border:1px solid rgba(148,163,184,.12);font-size:9px;color:#cbd5e1}.composer{display:flex;justify-content:space-between;color:#64748b}.composer button{width:24px;border:0;border-radius:7px;background:#7c3aed;color:#fff}
        .preview-head{display:grid;grid-template-columns:92px minmax(220px,1fr) auto;gap:8px;align-items:center;margin-bottom:8px}.preview-search{height:28px;border-radius:9px;border:1px solid rgba(148,163,184,.16);background:rgba(2,6,23,.55);display:flex;align-items:center;padding:0 10px;color:#94a3b8;font-size:9px;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
        .preview-actions{display:flex;align-items:center;gap:7px;color:#94a3b8;font-size:9px;white-space:nowrap}.bell{font-size:11px}.mini-avatar{width:26px;height:26px;border-radius:999px;display:grid;place-items:center;background:linear-gradient(135deg,#f59e0b,#7c3aed);color:#fff;font-size:11px;font-weight:800}.mini-user{line-height:1.05}.mini-user b{display:block;font-size:10px;color:#fff}.mini-user small{display:block;font-size:8px;color:#94a3b8}.device-icons{letter-spacing:3px}
        .url{height:28px;border-radius:9px;background:rgba(2,6,23,.75);border:1px solid rgba(148,163,184,.12);display:flex;align-items:center;padding:0 10px;color:#cbd5e1;font-size:9px}
      `}</style>
    </main>
  );
}

function DefaultWorkspacePreview({ selected }: { selected: WorkspaceConfig }) {
  return (
    <div className="site">
      <nav><b>Streams</b><span>{selected.title}</span><span>{selected.component}</span><span>Truth</span><button type="button">Get Started</button></nav>
      <h2>{selected.previewTitle}<br /><em>{selected.previewSubtitle}</em></h2>
      <p>Active workspace context, preview mode, source truth, bottom panels, and notifications are synced.</p>
      <div className="plans">{[["Workspace", selected.title, "Open"], ["Component", selected.component, "Inspect"], ["Truth", selected.route, "Verify"]].map(([name, detail, cta], index) => <div className={`plan ${index === 2 ? "featured" : ""}`} key={name}><b>{name}</b><h4>{detail}</h4><p>Bound to current workspace</p><ul><li>✓ Route synced</li><li>✓ Component synced</li><li>✓ File synced</li></ul><button type="button">{cta}</button></div>)}</div>
      <style jsx>{previewStyles}</style>
    </div>
  );
}

function VisualEditingWorkspace({ elements, selectedElement, selectedElementId, setSelectedElementId, updateSelectedElement, updateSelectedStyle, duplicateSelectedElement, resetVisualEditor }: {
  elements: EditableElement[];
  selectedElement: EditableElement;
  selectedElementId: string;
  setSelectedElementId: (id: string) => void;
  updateSelectedElement: (patch: Partial<EditableElement>) => void;
  updateSelectedStyle: (patch: Partial<EditableElement["style"]>) => void;
  duplicateSelectedElement: () => void;
  resetVisualEditor: () => void;
}) {
  return (
    <div className="visual-editor">
      <div className="visual-toolbar"><div><b>Editable Front View</b><small>Click an element to edit text, style, spacing, size, and artifact data.</small></div><button type="button" onClick={duplicateSelectedElement}>Duplicate Element</button><button type="button" onClick={resetVisualEditor}>Reset Canvas</button></div>
      <div className="editor-body">
        <div className="layers-panel"><b>Layers</b>{elements.map((element) => <button key={element.id} type="button" className={element.id === selectedElementId ? "selected" : ""} onClick={() => setSelectedElementId(element.id)}><span>{element.type}</span>{element.label}</button>)}</div>
        <div className="editable-canvas"><div className="canvas-page">{elements.map((element) => <EditableCanvasElement key={element.id} element={element} isSelected={element.id === selectedElementId} onSelect={() => setSelectedElementId(element.id)} />)}</div></div>
        <div className="inline-inspector"><b>Quick Edit</b><label>Text<textarea value={selectedElement.text} onChange={(event) => updateSelectedElement({ text: event.target.value })} /></label><div className="mini-grid"><label>Size<input type="number" value={selectedElement.style.fontSize} onChange={(event) => updateSelectedStyle({ fontSize: Number(event.target.value) })} /></label><label>Width<input type="number" value={selectedElement.style.width} onChange={(event) => updateSelectedStyle({ width: Number(event.target.value) })} /></label></div><div className="mini-grid"><label>Text Color<input type="color" value={selectedElement.style.color} onChange={(event) => updateSelectedStyle({ color: event.target.value })} /></label><label>Fill<input type="color" value={colorOrFallback(selectedElement.style.background)} onChange={(event) => updateSelectedStyle({ background: event.target.value })} /></label></div><div className="patch-box"><b>Patch Preview</b>{buildPatchSummary(selectedElement).map((item) => <p key={item}>{item}</p>)}</div></div>
      </div>
      <style jsx>{`
        .visual-editor{margin-top:4px;height:calc(100% - 104px);min-height:260px;border-radius:12px;border:1px solid rgba(148,163,184,.12);background:radial-gradient(circle at 75% 15%,rgba(124,58,237,.16),transparent 22%),#020617;overflow:hidden;display:grid;grid-template-rows:34px minmax(0,1fr)}
        .visual-toolbar{height:34px;display:flex;align-items:center;gap:8px;padding:0 8px;border-bottom:1px solid rgba(148,163,184,.12)}.visual-toolbar div{margin-right:auto;line-height:1}.visual-toolbar b{display:block;font-size:10px}.visual-toolbar small{display:block;margin-top:3px;color:#94a3b8;font-size:8px}.visual-toolbar button{height:24px;border:1px solid rgba(148,163,184,.16);border-radius:7px;background:rgba(15,23,42,.9);color:#fff;font-size:8px;cursor:pointer}
        .editor-body{min-height:0;display:grid;grid-template-columns:120px minmax(0,1fr) 210px;gap:8px;padding:8px}.layers-panel,.inline-inspector{min-height:0;overflow:auto;border:1px solid rgba(148,163,184,.12);background:rgba(15,23,42,.7);border-radius:10px;padding:8px}.layers-panel b,.inline-inspector>b{display:block;font-size:10px;margin-bottom:8px}.layers-panel button{width:100%;display:block;border:1px solid rgba(148,163,184,.12);background:rgba(2,6,23,.58);color:#cbd5e1;border-radius:8px;margin-bottom:6px;padding:7px;text-align:left;font-size:8px;cursor:pointer}.layers-panel button.selected{border-color:rgba(139,92,246,.85);background:rgba(124,58,237,.3);color:#fff}.layers-panel span{display:block;color:#94a3b8;font-size:7px;text-transform:uppercase;margin-bottom:3px}
        .editable-canvas{min-width:0;min-height:0;overflow:auto;border-radius:12px;background:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px),rgba(2,6,23,.72);background-size:22px 22px;border:1px solid rgba(148,163,184,.12);padding:14px}.canvas-page{min-height:100%;border-radius:16px;border:1px solid rgba(148,163,184,.13);background:radial-gradient(circle at 80% 24%,rgba(37,99,235,.24),transparent 20%),#020617;display:flex;flex-direction:column;align-items:center;padding:16px}
        .inline-inspector label{display:block;color:#94a3b8;font-size:8px;margin-bottom:7px}.inline-inspector input,.inline-inspector textarea{width:100%;margin-top:4px;border:1px solid rgba(148,163,184,.14);background:rgba(2,6,23,.8);color:#fff;border-radius:7px;font-size:9px;padding:6px}.inline-inspector textarea{min-height:66px;resize:vertical}.mini-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}.patch-box{border:1px solid rgba(148,163,184,.12);border-radius:8px;padding:8px;background:rgba(2,6,23,.55)}.patch-box p{margin:5px 0;color:#cbd5e1;font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      `}</style>
    </div>
  );
}

function EditableCanvasElement({ element, isSelected, onSelect }: { element: EditableElement; isSelected: boolean; onSelect: () => void }) {
  return (
    <button type="button" className={`editable-element ${element.type} ${isSelected ? "selected" : ""}`} style={visualStyleToCss(element)} onClick={onSelect}>
      {element.type === "artifact" ? <><span className="artifact-badge">{element.artifactKind ?? "artifact"}</span><strong>{element.label}</strong><small>{element.artifactUrl || "No artifact URL connected"}</small><em>{element.text}</em></> : element.type === "card" ? <><strong>{element.label}</strong><small>{element.text}</small></> : element.text}
      <style jsx>{`.editable-element{position:relative;border:1px solid transparent;outline:0;cursor:pointer;transition:border-color .15s ease,box-shadow .15s ease}.editable-element:hover{border-color:rgba(139,92,246,.55);box-shadow:0 0 0 2px rgba(139,92,246,.14)}.editable-element.selected{border-color:#a78bfa;box-shadow:0 0 0 2px rgba(167,139,250,.26),0 0 36px rgba(124,58,237,.24)}.editable-element.selected:after{content:"selected";position:absolute;top:-18px;right:0;height:16px;padding:0 6px;border-radius:999px;background:#7c3aed;color:#fff;font-size:8px;display:grid;place-items:center}.editable-element.card,.editable-element.artifact{display:flex;flex-direction:column;justify-content:space-between}.editable-element strong{display:block;font-size:11px;margin-bottom:6px}.editable-element small,.editable-element em{display:block;color:inherit;opacity:.86;font-size:10px;font-style:normal;line-height:1.3}.artifact-badge{width:max-content;border-radius:999px;background:rgba(96,165,250,.2);color:#bfdbfe;padding:3px 7px;font-size:8px;margin-bottom:8px;text-transform:uppercase}`}</style>
    </button>
  );
}

function VisualEditorRightRail({ selectedElement, updateSelectedElement, updateSelectedStyle, duplicateSelectedElement, resetVisualEditor }: {
  selectedElement: EditableElement;
  updateSelectedElement: (patch: Partial<EditableElement>) => void;
  updateSelectedStyle: (patch: Partial<EditableElement["style"]>) => void;
  duplicateSelectedElement: () => void;
  resetVisualEditor: () => void;
}) {
  return (
    <aside className="visual-right sb-panel">
      <h3>VISUAL EDITOR INSPECTOR</h3>
      <section><b>Selected Element</b><label>Label<input value={selectedElement.label} onChange={(event) => updateSelectedElement({ label: event.target.value })} /></label><label>Text<textarea value={selectedElement.text} onChange={(event) => updateSelectedElement({ text: event.target.value })} /></label></section>
      <section><b>Typography</b><label>Font Family<select value={selectedElement.style.fontFamily} onChange={(event) => updateSelectedStyle({ fontFamily: event.target.value })}><option>Inter</option><option>Arial</option><option>Georgia</option><option>system-ui</option></select></label><div className="control-grid"><label>Size<input type="number" value={selectedElement.style.fontSize} onChange={(event) => updateSelectedStyle({ fontSize: Number(event.target.value) })} /></label><label>Weight<input type="number" min="100" max="900" step="100" value={selectedElement.style.fontWeight} onChange={(event) => updateSelectedStyle({ fontWeight: Number(event.target.value) })} /></label></div><div className="control-grid"><label>Line<input type="number" step="0.05" value={selectedElement.style.lineHeight} onChange={(event) => updateSelectedStyle({ lineHeight: Number(event.target.value) })} /></label><label>Spacing<input type="number" value={selectedElement.style.letterSpacing} onChange={(event) => updateSelectedStyle({ letterSpacing: Number(event.target.value) })} /></label></div><label>Align<select value={selectedElement.style.align} onChange={(event) => updateSelectedStyle({ align: event.target.value as EditableElement["style"]["align"] })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label></section>
      <section><b>Color + Box</b><div className="control-grid"><label>Text<input type="color" value={selectedElement.style.color} onChange={(event) => updateSelectedStyle({ color: event.target.value })} /></label><label>Fill<input type="color" value={colorOrFallback(selectedElement.style.background)} onChange={(event) => updateSelectedStyle({ background: event.target.value })} /></label></div></section>
      <section><b>Resize + Spacing</b><div className="control-grid"><label>Width<input type="number" value={selectedElement.style.width} onChange={(event) => updateSelectedStyle({ width: Number(event.target.value) })} /></label><label>Height<input type="number" value={selectedElement.style.height} onChange={(event) => updateSelectedStyle({ height: Number(event.target.value) })} /></label></div><div className="control-grid"><label>Padding<input type="number" value={selectedElement.style.padding} onChange={(event) => updateSelectedStyle({ padding: Number(event.target.value) })} /></label><label>Top Gap<input type="number" value={selectedElement.style.marginTop} onChange={(event) => updateSelectedStyle({ marginTop: Number(event.target.value) })} /></label></div><label>Radius<input type="number" value={selectedElement.style.borderRadius} onChange={(event) => updateSelectedStyle({ borderRadius: Number(event.target.value) })} /></label></section>
      <section><b>Source Truth</b><p>Route: {selectedElement.route}</p><p>Component: {selectedElement.component}</p><p>File: {selectedElement.file}</p><p>GitHub: {selectedElement.github}</p></section>
      <div className="rail-actions"><button className="sb-btn primary" type="button">Save Patch</button><button className="sb-btn" type="button" onClick={duplicateSelectedElement}>Duplicate</button><button className="sb-btn red" type="button" onClick={resetVisualEditor}>Reset</button></div>
      <style jsx>{`
        .visual-right{padding:10px;overflow:auto;min-height:0}.visual-right h3{font-size:10px;margin-bottom:12px}.visual-right section{border:1px solid rgba(148,163,184,.12);border-radius:12px;background:rgba(15,23,42,.72);padding:10px;margin-bottom:10px}.visual-right b{display:block;font-size:10px;margin-bottom:8px}.visual-right label{display:block;color:#94a3b8;font-size:8px;margin-top:8px}.visual-right input,.visual-right textarea,.visual-right select{width:100%;margin-top:5px;border:1px solid rgba(148,163,184,.14);background:rgba(2,6,23,.85);color:#fff;border-radius:7px;font-size:9px;padding:7px}.visual-right textarea{min-height:82px;resize:vertical}.control-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.visual-right p{margin:6px 0;color:#cbd5e1;font-size:9px;word-break:break-word}.rail-actions{position:sticky;bottom:0;display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;background:#050a16;padding-top:8px}
      `}</style>
    </aside>
  );
}

function SourceStrip({ source }: { source: SourceTruth }) {
  return <div className="source-strip"><div><span>Route</span>{source.route}</div><div><span>Component</span>{source.component}</div><div><span>File</span>{source.file}</div><div><span>GitHub</span>{source.github}</div><style jsx>{`.source-strip{height:42px;margin-top:6px;border:1px solid rgba(148,163,184,.12);border-radius:9px;background:rgba(15,23,42,.72);display:grid;grid-template-columns:1fr 1fr 2fr 2fr;gap:8px;padding:7px 10px;overflow:hidden}.source-strip div{min-width:0;font-size:9px;color:#fff;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.source-strip span{display:block;color:#94a3b8;font-size:7px;font-weight:600;margin-bottom:3px}`}</style></div>;
}

function MiniReview({ value }: { value: string }) { return <section className="mini-review sb-panel"><h3>MINI REVIEW WINDOW</h3><p>{value}</p><style jsx>{`.mini-review{grid-row:2;grid-column:1;padding:8px;overflow:hidden}.mini-review p{margin:0;background:#fff;color:#111827;border-radius:6px;padding:10px;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`}</style></section>; }
function BottomList({ title, items }: { title: string; items: string[] }) { return <section className="bottom-list sb-panel"><h3>{title}</h3>{items.map((item) => <p key={item}>{item}</p>)}<style jsx>{`.bottom-list{grid-row:2;padding:8px;overflow:hidden}.bottom-list h3{font-size:18px;font-weight:400;margin:0 0 6px}.bottom-list p{margin:4px 0;color:#e2e8f0;font-size:16px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`}</style></section>; }

function ProjectNotificationCenter({ selected }: { selected: WorkspaceConfig }) {
  return <aside className="notify sb-panel"><h3>PROJECT MONITOR + NOTIFICATIONS</h3>{selected.notifications.map((item) => <article key={`${item.title}-${item.file}`}><b>{item.title}</b><small>{item.status}</small><p>{item.summary}</p><div><span>Route<br /><b>{item.route}</b></span><span>Component<br /><b>{item.component}</b></span><span>File<br /><b>{item.file}</b></span></div><footer><button type="button">Open</button><button type="button">Comment</button><button type="button">Rollback</button></footer></article>)}<style jsx>{`.notify{padding:10px;overflow:auto}.notify h3{font-size:18px;font-weight:400}.notify article{border:1px solid rgba(148,163,184,.12);border-radius:12px;padding:10px;background:rgba(15,23,42,.7)}.notify b{font-size:10px}.notify small{float:right;color:#93c5fd}.notify p{font-size:10px;color:#cbd5e1}.notify div{display:grid;grid-template-columns:1fr 1fr 2fr;gap:6px;font-size:8px}.notify footer{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:8px}.notify button{height:28px;border-radius:8px;border:1px solid rgba(148,163,184,.14);background:rgba(15,23,42,.9);color:#fff;font-size:9px}`}</style></aside>;
}

function buildPatchSummary(element: EditableElement) { return [`target: ${element.file}`, `component: ${element.component}`, `text: ${JSON.stringify(element.text)}`, `font-size: ${element.style.fontSize}px`, `width: ${element.style.width}px / height: ${element.style.height}px`]; }
function colorOrFallback(value: string) { return value && value.startsWith("#") ? value : "#020617"; }
function visualStyleToCss(element: EditableElement): CSSProperties { return { fontFamily: element.style.fontFamily, fontSize: element.style.fontSize, fontWeight: element.style.fontWeight, color: element.style.color, background: element.style.background === "transparent" ? "transparent" : element.style.background, width: element.style.width, minHeight: element.style.height, padding: element.style.padding, marginTop: element.style.marginTop, borderRadius: element.style.borderRadius, letterSpacing: element.style.letterSpacing, lineHeight: element.style.lineHeight, textAlign: element.style.align, display: "grid", placeItems: element.type === "text" || element.type === "button" ? "center" : undefined }; }

const previewStyles = `
  .site{height:calc(100% - 104px);margin-top:4px;border-radius:12px;background:#050b1c;color:white;padding:16px;overflow:auto}.site nav{display:flex;align-items:center;gap:26px;font-size:10px}.site nav button{margin-left:auto;border:0;border-radius:8px;background:#7c3aed;color:white;height:30px;padding:0 14px}.site h2{text-align:center;font-size:32px;font-weight:400;line-height:1.08;margin:34px 0 4px}.site h2 em{font-style:normal;color:#8b5cf6}.site>p{text-align:center;color:#bfdbfe;font-size:11px}.plans{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:28px}.plan{border:1px solid rgba(148,163,184,.18);border-radius:14px;background:rgba(15,23,42,.7);padding:16px}.plan.featured{border-color:#8b5cf6}.plan b{font-size:18px}.plan h4{font-size:20px;font-weight:400;margin:18px 0}.plan p,.plan li{font-size:10px;color:#dbeafe}.plan ul{list-style:none;padding:0}.plan button{width:100%;border:0;border-radius:8px;background:#7c3aed;color:#fff;height:32px}
`;
