export type StreamsArtifactType =
  | "document"
  | "code"
  | "html"
  | "react"
  | "image"
  | "video"
  | "audio"
  | "table"
  | "chart"
  | "pdf"
  | "slides"
  | "bundle";

export type StreamsPreviewPlacement = "inline" | "right_pane" | "tab" | "both" | "none";

export interface StreamsArtifact {
  id: string;
  type: StreamsArtifactType;
  subtype?: string | null;
  title: string;
  mime?: string | null;
  preview_url?: string | null;
  download_url?: string | null;
  storage_path?: string | null;
  source_tool?: string | null;
  created_by_chat?: boolean;
  created_by_tab?: string | null;
  project_id?: string | null;
  session_id?: string | null;
  version?: number;
  status?: string;
  metadata?: Record<string, unknown>;
}

export interface StreamsPreviewDecision {
  placement: StreamsPreviewPlacement;
  activeTab?: string | null;
  reason: string;
}

export function decidePreviewPlacement(artifact: Pick<StreamsArtifact, "type" | "subtype" | "mime">): StreamsPreviewDecision {
  switch (artifact.type) {
    case "image":
    case "video":
    case "audio":
      return { placement: "both", activeTab: "generate", reason: "media artifacts should render inline and be available in Generate/Library" };

    case "react":
    case "html":
      return { placement: "right_pane", activeTab: "build", reason: "interactive UI/code artifacts need a right preview pane" };

    case "code":
    case "bundle":
      return { placement: "right_pane", activeTab: "build", reason: "code artifacts need editable preview/workspace" };

    case "document":
    case "pdf":
    case "slides":
      return { placement: "both", activeTab: "editor", reason: "documents should preview inline and open in Editor" };

    case "table":
    case "chart":
      return { placement: "both", activeTab: "reference", reason: "data artifacts should preview inline and be reusable in Reference" };

    default:
      return { placement: "inline", activeTab: null, reason: "default inline preview" };
  }
}
