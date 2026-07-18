export const UNIVERSAL_PROJECT_BAR_ITEMS = [
  "StreamsAI logo",
  "Project name",
  "Project type",
  "Save status",
  "Project status",
  "Version history",
  "Preview",
  "Share",
  "Export",
  "Publish or Complete",
  "User profile",
] as const;

export const GLOBAL_NAVIGATION_ITEMS = [
  "Home",
  "Projects",
  "Workspace",
  "Files",
  "Create",
  "Generate",
  "Build",
  "Assets",
  "Tasks",
  "History",
  "Ask AI",
  "Settings",
] as const;

export const PROJECT_CONTEXT_GROUPS = {
  overview: [
    "Project name",
    "Goal",
    "Audience",
    "Current status",
    "Project description",
    "Important instructions",
    "Brand or style preferences",
  ],
  filesAndInputs: [
    "Documents",
    "Images",
    "Screenshots",
    "Videos",
    "Audio",
    "Spreadsheets",
    "Code files",
    "Links",
    "Notes",
    "Original prompt",
  ],
  memory: [
    "User decisions",
    "Selected concepts",
    "Approved styles",
    "Rejected options",
    "Requirements",
    "Constraints",
    "Previous outputs",
  ],
  codingStructure: [
    "Files",
    "Routes",
    "Components",
    "Data",
    "APIs",
    "Requirements",
    "Repository",
    "Source truth",
    "Checkpoints",
  ],
} as const;

export const CANVAS_HEADER_ITEMS = [
  "Current output name",
  "View switcher",
  "Device preview",
  "Zoom",
  "Undo",
  "Redo",
  "Compare versions",
  "Full screen",
] as const;

export const RIGHT_PANEL_SECTIONS = {
  Properties: [
    "Size",
    "Position",
    "Layout",
    "Typography",
    "Spacing",
    "Style",
    "Color",
    "Visibility",
    "Behavior",
  ],
  Content: ["Title", "Description", "Button text", "Image", "Links", "Metadata"],
  Generate: [
    "Generate variation",
    "Replace",
    "Rewrite",
    "Expand",
    "Shorten",
    "Restyle",
    "Create alternatives",
  ],
  "Project Guidance": [
    "Missing items",
    "Recommended next steps",
    "Validation warnings",
    "Completion checklist",
  ],
  "Ask AI": [],
} as const;

export const UNIVERSAL_BOTTOM_TRAY_ITEMS = [
  "Assets",
  "Outputs",
  "Tasks",
  "Activity",
  "Versions",
  "Comments",
] as const;

export const CODING_BOTTOM_TRAY_EXTENSIONS = [
  "Console",
  "Logs",
  "Diff",
  "Proof",
  "Verification",
] as const;

export const BUILDER_WORKSTATION_MODES = [
  "Primary Builder",
  "Visual Editing",
  "Component Mapping",
  "Approval Center",
  "Browser Verification",
  "Repository Truth",
  "Projects Dashboard",
  "Truth Panel",
] as const;

export const BUILDER_LAYOUT_MODES = ["Single", "Multi", "Focus", "Stack"] as const;

export const BUILDER_CANVAS_MODES = [
  "Front View Editor",
  "Browser Review",
  "Mobile Preview",
  "GitHub-Style Code Editor",
  "Side-by-Side Code + Preview",
  "Component Mapping",
  "Approval Center",
  "Browser Verification",
  "Repository Truth",
  "Projects Dashboard",
  "Truth Panel",
] as const;

export const CODE_EDITOR_PROTECTED_CAPABILITIES = [
  "GitHub-style visual design",
  "Light top file toolbar",
  "File path",
  "Line count",
  "Character count",
  "SHA",
  "Copy selection",
  "Download file",
  "Edit tools",
  "More tools",
  "Utility status row",
  "Cursor line",
  "Cursor column",
  "Character offset",
  "History control",
  "Matching synchronized line-number gutter",
  "Search highlighting",
  "Selection highlighting",
  "Find",
  "Replace",
  "Go To",
  "Copy line",
  "Copy selection",
  "Copy all",
  "Highlight",
  "Circle",
  "Underline",
  "External visual-to-code commands",
] as const;

export const FRONT_VIEW_EDITOR_PROTECTED_CAPABILITIES = [
  "Edit rendered user-facing frontend",
  "Element classification",
  "Exact visual selection payload",
  "Parent navigation",
  "Child navigation",
  "Direct text editing",
  "Image replacement",
  "Remove or delete",
  "Rotate",
  "Front or z-index action",
  "Move",
  "Resize",
  "Selected-element toolbar",
  "Scroll-position preservation",
  "Safety blocking",
  "Safety recommendations",
  "Visual-to-source lookup",
  "Shared visual and code draft",
  "Patch invalidation after edits",
  "Preview invalidation after edits",
] as const;

export const REPOSITORY_AND_PREVIEW_PROTECTED_CAPABILITIES = [
  "Repository listing",
  "Branch selection",
  "Folder selection",
  "File selection",
  "Exact file pull",
  "SHA tracking",
  "Quick Source Push",
  "Reviewed Builder Push",
  "Controlled patch generation",
  "Temporary Git branch creation",
  "Vercel preview polling",
  "Side-by-side code and preview",
  "Desktop review",
  "iPhone review",
  "Safari frame",
  "Chrome frame",
  "Full screen",
  "Safe Zone",
  "Source truth",
  "Proof",
  "Browser verification contract",
  "Approval gates",
  "Builder context events",
] as const;

export const UNIVERSAL_PROJECT_TYPES = [
  "Website",
  "Marketing campaign",
  "Document or report",
  "Coding or application",
  "Image or brand",
  "Video",
  "Research",
  "Presentation",
  "Workflow",
  "Business planning",
  "Future project type",
] as const;

export const PROJECT_OVERVIEW_FIELDS = [
  "Project Goal",
  "Current Stage",
  "Progress",
  "Next Recommended Action",
] as const;

export const PROJECT_CREATION_QUESTIONS = [
  "What do you want to create or complete?",
  "Do you have files, images, notes, or references?",
  "What should the finished result look like?",
  "Are there requirements or constraints?",
] as const;

export const PRESERVED_EXISTING_COMPONENTS = [
  "src/components/streams-builder/WorkspaceGrid.tsx",
  "src/components/streams-builder/GitHubRepositoryPicker.tsx",
  "src/components/streams-builder/VisualEditingWorkstation.tsx",
  "src/components/streams-builder/RuntimeCodeEditor.tsx",
  "src/components/streams-builder/BuilderCenterChat.tsx",
  "src/components/streams-builder/BuilderControlLayers.tsx",
  "src/components/streams-builder/LiveFrontendWorkstation.tsx",
  "src/components/streams-builder/TopRowWorkstationControls.tsx",
  "src/components/streams-builder/VisualEditorScrollBehavior.tsx",
  "src/components/streams-builder/VisualOperationDock.tsx",
  "src/components/streams-builder/VisualPropertyInspector.tsx",
  "src/components/streams-builder/WorkstationChromeEnhancer.tsx",
  "src/components/streams-builder/VisualEditorCodeDock.tsx",
  "src/components/streams-builder/VisualSelectionPatchPanel.tsx",
  "src/components/streams-builder/WorkspaceBridgeSourceOfTruth.tsx",
  "src/components/streams-builder/BuilderContextEventSink.tsx",
  "src/components/streams-builder/CanonicalPreviewEventBridge.tsx",
  "src/components/streams-builder/CanonicalPreviewWorkspaceSurface.tsx",
  "src/components/streams-builder/PreviewCanvasFixStyles.tsx",
  "src/components/streams-builder/VisualEditorCanvasFixStyles.tsx",
] as const;

export const PRESERVED_EXISTING_ROUTES = [
  "src/app/streams-ai/streams-builder/page.tsx",
  "src/app/api/streams-builder/editable-preview/route.ts",
  "src/app/api/streams-builder/line-patches/route.ts",
  "src/app/api/streams-builder/preview-build/route.ts",
  "src/app/api/streams-builder/github/repos/route.ts",
  "src/app/api/streams-builder/github/tree/route.ts",
  "src/app/api/streams-builder/github/file/route.ts",
  "src/app/api/streams-builder/github/push/route.ts",
  "src/app/api/streams-builder/repository-execution/route.ts",
  "src/app/api/streams-builder/browser-verification/route.ts",
  "src/app/api/streams-builder/context-events/route.ts",
  "src/app/api/streams-builder/env-readiness/route.ts",
] as const;

export const REPLACEMENT_CONVERSION_RULES = [
  "The new workspace replaces the old frontend after verified parity.",
  "The new workspace is not a companion extension.",
  "Existing editors are combined, not rebuilt.",
  "Existing services remain authoritative.",
  "Legacy surfaces remain available until production parity and rollback are proven.",
  "No confirmed capability may be removed before its parity test passes.",
] as const;

export function buildWorkspacePreservationContract() {
  return {
    universalProjectBar: UNIVERSAL_PROJECT_BAR_ITEMS,
    globalNavigation: GLOBAL_NAVIGATION_ITEMS,
    projectContext: PROJECT_CONTEXT_GROUPS,
    canvasHeader: CANVAS_HEADER_ITEMS,
    rightPanel: RIGHT_PANEL_SECTIONS,
    universalBottomTray: UNIVERSAL_BOTTOM_TRAY_ITEMS,
    codingBottomTrayExtensions: CODING_BOTTOM_TRAY_EXTENSIONS,
    workstationModes: BUILDER_WORKSTATION_MODES,
    layoutModes: BUILDER_LAYOUT_MODES,
    builderCanvasModes: BUILDER_CANVAS_MODES,
    codeEditorCapabilities: CODE_EDITOR_PROTECTED_CAPABILITIES,
    frontViewEditorCapabilities: FRONT_VIEW_EDITOR_PROTECTED_CAPABILITIES,
    repositoryAndPreviewCapabilities: REPOSITORY_AND_PREVIEW_PROTECTED_CAPABILITIES,
    projectTypes: UNIVERSAL_PROJECT_TYPES,
    projectOverview: PROJECT_OVERVIEW_FIELDS,
    projectCreationQuestions: PROJECT_CREATION_QUESTIONS,
    existingComponents: PRESERVED_EXISTING_COMPONENTS,
    existingRoutes: PRESERVED_EXISTING_ROUTES,
    replacementRules: REPLACEMENT_CONVERSION_RULES,
  } as const;
}
