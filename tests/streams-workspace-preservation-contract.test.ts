import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildWorkspacePreservationContract,
  BUILDER_CANVAS_MODES,
  BUILDER_LAYOUT_MODES,
  BUILDER_WORKSTATION_MODES,
  CANVAS_HEADER_ITEMS,
  CODE_EDITOR_PROTECTED_CAPABILITIES,
  FRONT_VIEW_EDITOR_PROTECTED_CAPABILITIES,
  GLOBAL_NAVIGATION_ITEMS,
  PRESERVED_EXISTING_COMPONENTS,
  PRESERVED_EXISTING_ROUTES,
  PROJECT_CREATION_QUESTIONS,
  PROJECT_OVERVIEW_FIELDS,
  REPLACEMENT_CONVERSION_RULES,
  REPOSITORY_AND_PREVIEW_PROTECTED_CAPABILITIES,
  RIGHT_PANEL_SECTIONS,
  UNIVERSAL_BOTTOM_TRAY_ITEMS,
  UNIVERSAL_PROJECT_BAR_ITEMS,
  UNIVERSAL_PROJECT_TYPES,
} from "../src/components/streams-workspace/preservation-contract";

describe("universal project workspace replacement preservation contract", () => {
  it("locks the complete universal project bar and global navigation", () => {
    expect(UNIVERSAL_PROJECT_BAR_ITEMS).toEqual([
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
    ]);
    expect(GLOBAL_NAVIGATION_ITEMS).toEqual([
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
    ]);
  });

  it("locks the universal canvas, right-panel, tray, overview, and creation contracts", () => {
    expect(CANVAS_HEADER_ITEMS).toEqual([
      "Current output name",
      "View switcher",
      "Device preview",
      "Zoom",
      "Undo",
      "Redo",
      "Compare versions",
      "Full screen",
    ]);
    expect(Object.keys(RIGHT_PANEL_SECTIONS)).toEqual([
      "Properties",
      "Content",
      "Generate",
      "Project Guidance",
      "Ask AI",
    ]);
    expect(UNIVERSAL_BOTTOM_TRAY_ITEMS).toEqual([
      "Assets",
      "Outputs",
      "Tasks",
      "Activity",
      "Versions",
      "Comments",
    ]);
    expect(PROJECT_OVERVIEW_FIELDS).toEqual([
      "Project Goal",
      "Current Stage",
      "Progress",
      "Next Recommended Action",
    ]);
    expect(PROJECT_CREATION_QUESTIONS).toHaveLength(4);
    expect(UNIVERSAL_PROJECT_TYPES).toContain("Coding or application");
    expect(UNIVERSAL_PROJECT_TYPES).toContain("Website");
  });

  it("locks every current builder workstation and layout mode", () => {
    expect(BUILDER_WORKSTATION_MODES).toEqual([
      "Primary Builder",
      "Visual Editing",
      "Component Mapping",
      "Approval Center",
      "Browser Verification",
      "Repository Truth",
      "Projects Dashboard",
      "Truth Panel",
    ]);
    expect(BUILDER_LAYOUT_MODES).toEqual(["Single", "Multi", "Focus", "Stack"]);
    expect(BUILDER_CANVAS_MODES).toContain("Front View Editor");
    expect(BUILDER_CANVAS_MODES).toContain("GitHub-Style Code Editor");
    expect(BUILDER_CANVAS_MODES).toContain("Side-by-Side Code + Preview");
  });

  it("locks the GitHub-style runtime code editor capabilities", () => {
    const required = [
      "GitHub-style visual design",
      "Light top file toolbar",
      "File path",
      "Line count",
      "Character count",
      "SHA",
      "Utility status row",
      "History control",
      "Matching synchronized line-number gutter",
      "Find",
      "Replace",
      "Go To",
      "Highlight",
      "Circle",
      "Underline",
      "External visual-to-code commands",
    ];
    for (const capability of required) {
      expect(CODE_EDITOR_PROTECTED_CAPABILITIES).toContain(capability);
    }
  });

  it("locks the editable frontend and visual-to-source capabilities", () => {
    const required = [
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
      "Scroll-position preservation",
      "Safety blocking",
      "Safety recommendations",
      "Visual-to-source lookup",
      "Shared visual and code draft",
      "Patch invalidation after edits",
      "Preview invalidation after edits",
    ];
    for (const capability of required) {
      expect(FRONT_VIEW_EDITOR_PROTECTED_CAPABILITIES).toContain(capability);
    }
  });

  it("locks repository, temporary preview, review, proof, and push capabilities", () => {
    const required = [
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
    ];
    for (const capability of required) {
      expect(REPOSITORY_AND_PREVIEW_PROTECTED_CAPABILITIES).toContain(capability);
    }
  });

  it("locks the existing implementation files as preserved dependencies", () => {
    expect(PRESERVED_EXISTING_COMPONENTS).toContain(
      "src/components/streams-builder/RuntimeCodeEditor.tsx",
    );
    expect(PRESERVED_EXISTING_COMPONENTS).toContain(
      "src/components/streams-builder/VisualEditingWorkstation.tsx",
    );
    expect(PRESERVED_EXISTING_COMPONENTS).toContain(
      "src/components/streams-builder/GitHubRepositoryPicker.tsx",
    );
    expect(PRESERVED_EXISTING_ROUTES).toContain(
      "src/app/api/streams-builder/editable-preview/route.ts",
    );
    expect(PRESERVED_EXISTING_ROUTES).toContain(
      "src/app/api/streams-builder/preview-build/route.ts",
    );
    expect(PRESERVED_EXISTING_ROUTES).toContain(
      "src/app/api/streams-builder/github/push/route.ts",
    );
  });

  it("locks replacement conversion instead of extension or duplicate systems", () => {
    expect(REPLACEMENT_CONVERSION_RULES).toContain(
      "The new workspace replaces the old frontend after verified parity.",
    );
    expect(REPLACEMENT_CONVERSION_RULES).toContain(
      "The new workspace is not a companion extension.",
    );
    expect(REPLACEMENT_CONVERSION_RULES).toContain(
      "Existing editors are combined, not rebuilt.",
    );
    expect(REPLACEMENT_CONVERSION_RULES).toContain(
      "No confirmed capability may be removed before its parity test passes.",
    );
  });

  it("wires durable project state through existing projects, jobs, and events", () => {
    const repository = readFileSync(resolve(process.cwd(), "src/lib/streams-builder/durable-workspace-state.ts"), "utf8");
    const route = readFileSync(resolve(process.cwd(), "src/app/api/streams-builder/workspace-state/route.ts"), "utf8");
    const bridge = readFileSync(resolve(process.cwd(), "src/components/streams-workspace/BuilderWorkspacePersistenceBridge.tsx"), "utf8");
    const shell = readFileSync(resolve(process.cwd(), "src/components/streams-workspace/ProjectWorkspaceShell.tsx"), "utf8");

    expect(repository).toContain("streamsAITables.projects");
    expect(repository).toContain("streamsAITables.jobs");
    expect(repository).toContain("StreamsAIJobsRepository");
    expect(repository).toContain("BUILDER_STATE_REVISION_CONFLICT");
    expect(repository).toContain("MAX_BUILDER_WORKSPACE_SNAPSHOT_BYTES");
    expect(route).toContain("requireStreamsAIScope");
    expect(route).toContain("workspaceState.save");
    expect(bridge).toContain("streams-builder:pulled-file");
    expect(bridge).toContain("streams-builder:code-draft-changed");
    expect(bridge).toContain("BroadcastChannel");
    expect(bridge).toContain("expectedRevision");
    expect(shell).toContain("<BuilderWorkspacePersistenceBridge />");
  });

  it("returns one complete contract for the shell and parity tests", () => {
    const contract = buildWorkspacePreservationContract();
    expect(contract.universalProjectBar).toBe(UNIVERSAL_PROJECT_BAR_ITEMS);
    expect(contract.workstationModes).toBe(BUILDER_WORKSTATION_MODES);
    expect(contract.codeEditorCapabilities).toBe(CODE_EDITOR_PROTECTED_CAPABILITIES);
    expect(contract.frontViewEditorCapabilities).toBe(
      FRONT_VIEW_EDITOR_PROTECTED_CAPABILITIES,
    );
    expect(contract.existingComponents.length).toBeGreaterThan(15);
    expect(contract.existingRoutes.length).toBeGreaterThan(10);
  });
});
