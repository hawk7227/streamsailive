export type VisualEditorBuildStatus = "done" | "started" | "needs_backend" | "needs_mapping" | "planned";

export type VisualEditorBuildItem = {
  id: number;
  title: string;
  status: VisualEditorBuildStatus;
  limitation: string;
  robustTarget: string;
};

export type VisualEditorBuildGroup = {
  id: string;
  title: string;
  safeBuildReason: string;
  items: VisualEditorBuildItem[];
  nextActions: string[];
};

export const VISUAL_EDITOR_BUILD_GROUPS: VisualEditorBuildGroup[] = [
  {
    id: "draft-patch-push",
    title: "Draft, patch, approval, GitHub push",
    safeBuildReason: "These belong together because no GitHub write should happen until a draft exists, a patch is generated, and the user approves the preview.",
    items: [
      { id: 1, title: "Visual Editor Save / Push flow", status: "started", limitation: "Save Draft, Generate Patch, and Push GitHub buttons exist, but the draft is browser-local and patching still falls back to full-file replacement.", robustTarget: "DB-backed draft, patch preview, approval checkpoint, commit SHA, deployment verification." },
      { id: 6, title: "Draft library", status: "started", limitation: "Drafts are saved to local browser storage only.", robustTarget: "Project draft library API, list/open/duplicate/delete, draft thumbnails, version history." },
      { id: 7, title: "Patch generation", status: "started", limitation: "Current safe fallback is replace_full_file; range patching must be added for exact edits.", robustTarget: "Patch planner that uses replace_range and delete_range first, replace_full_file only as fallback." },
      { id: 8, title: "GitHub push approval gate", status: "started", limitation: "Push is separated from draft save, but there is not yet a complete approval modal with before/after evidence.", robustTarget: "Approval modal with diff, frontend preview, push target, commit SHA, rollback option." },
    ],
    nextActions: ["Create persistent visual-drafts API/table.", "Add patch preview diff panel.", "Require explicit approval checkpoint before Push GitHub.", "Store commit SHA and push history on the draft."],
  },
  {
    id: "visual-edit-mapping",
    title: "Text, panel, image, and layout source mapping",
    safeBuildReason: "These all start as DOM edit events and must be converted into exact source edits before they can be trusted.",
    items: [
      { id: 2, title: "Panel / layout deletion", status: "started", limitation: "Panel selection/removal exists in preview, but exact JSX block deletion is not yet reliable.", robustTarget: "DOM selector and text fingerprint mapped to JSX range, then delete_range patch." },
      { id: 3, title: "Image replacement", status: "started", limitation: "Image replacement is tracked visually but not uploaded and patched into source permanently.", robustTarget: "Upload asset, create asset record, replace src/import/background reference, preview, push." },
      { id: 4, title: "Drag / resize / rotate layout editing", status: "started", limitation: "Transforms are preview-side events and are not yet converted into responsive source code.", robustTarget: "Tailwind/className/style patch generator with desktop/mobile conflict checks." },
      { id: 5, title: "Text editing", status: "started", limitation: "Text edits work, but duplicate text can map to the wrong source occurrence.", robustTarget: "Selector + parent fingerprint + exact source line detection, then replace_range." },
      { id: 11, title: "Component/source mapping", status: "needs_mapping", limitation: "DOM selector does not yet identify the actual React component and source range.", robustTarget: "Component map index, JSX parser, source block registry, click visual element to source file/line." },
    ],
    nextActions: ["Create edit event schema shared by preview and workstation.", "Build source fingerprint mapper.", "Use delete_range for panels and replace_range for text/components.", "Add confidence score before patch generation."],
  },
  {
    id: "verification-rollback",
    title: "Preview verification, rollback, and safe deployment proof",
    safeBuildReason: "These are post-patch safeguards and should run before or immediately after GitHub push.",
    items: [
      { id: 9, title: "Frontend preview verification", status: "planned", limitation: "No automated build, screenshot, or deployment verification after patch generation.", robustTarget: "Build check, visual screenshot check, desktop/mobile preview, Vercel deployment status." },
      { id: 10, title: "Editable preview proxy", status: "started", limitation: "Proxy strips scripts to prevent crashes, so dynamic frontend behavior can be incomplete.", robustTarget: "Safe snapshot mode plus separate live interactive preview mode with error isolation." },
      { id: 13, title: "Undo / redo", status: "planned", limitation: "Edits are logged but not checkpointed as reversible draft versions.", robustTarget: "Undo, redo, restore checkpoint, compare versions." },
    ],
    nextActions: ["Add preview verification status model.", "Capture before/after screenshots.", "Add rollback/restore checkpoint actions.", "Track deploy status after commit."],
  },
  {
    id: "assets-project-library",
    title: "Assets and project library",
    safeBuildReason: "Image work and saved projects share the same storage concerns and should use the same project identity model.",
    items: [
      { id: 12, title: "Image / asset library", status: "planned", limitation: "No project asset upload, optimization, versioning, or usage tracking is wired to visual replacement.", robustTarget: "Project asset library with thumbnails, public URLs, source references, and reuse." },
      { id: 15, title: "Real project library", status: "planned", limitation: "Drafts and versions are not stored as a full project/version tree yet.", robustTarget: "Projects, drafts, versions, assets, patch history, commit history." },
    ],
    nextActions: ["Create projects/drafts/assets/version tables.", "Wire asset picker into Replace Image.", "Show draft thumbnails and latest preview status."],
  },
  {
    id: "multi-file-pr-workflow",
    title: "Multi-file and branch/PR workflow",
    safeBuildReason: "These are higher-risk write operations, so they should come after single-file patches and approval gates are strong.",
    items: [
      { id: 14, title: "Multi-file edits", status: "planned", limitation: "Current flow targets one active file, but real pages may span components, CSS, and assets.", robustTarget: "Patch bundles across files, preview all changed files, push multi-file commit." },
    ],
    nextActions: ["Add patch bundle model.", "Add branch/PR push option.", "Show multi-file diff and affected components before approval."],
  },
];

export const SAFE_VISUAL_EDITOR_BUILD_ORDER = [
  "draft-patch-push",
  "visual-edit-mapping",
  "verification-rollback",
  "assets-project-library",
  "multi-file-pr-workflow",
] as const;

export function getVisualEditorBuildGroups() {
  return VISUAL_EDITOR_BUILD_GROUPS;
}
