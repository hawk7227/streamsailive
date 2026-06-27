export type VisualComponentKind =
  | "page"
  | "section"
  | "panel"
  | "container"
  | "card"
  | "text"
  | "heading"
  | "button"
  | "image"
  | "video"
  | "link"
  | "list"
  | "form-field"
  | "spacer"
  | "divider";

export type VisualInsertPosition = "inside" | "before" | "after";
export type VisualResizeHandle = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

export type VisualRect = {
  x: number;
  y: number;
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

export type VisualComputedStyles = {
  backgroundColor?: string;
  color?: string;
  borderColor?: string;
  borderWidth?: string;
  borderRadius?: string;
  boxShadow?: string;
  padding?: string;
  margin?: string;
  display?: string;
  gridTemplateColumns?: string;
  flexDirection?: string;
  alignItems?: string;
  justifyContent?: string;
  gap?: string;
  objectFit?: string;
  fontSize?: string;
  fontWeight?: string;
  lineHeight?: string;
  letterSpacing?: string;
  opacity?: string;
  zIndex?: string;
  transform?: string;
};

export type VisualTarget = {
  id?: string;
  kind: VisualComponentKind;
  selector: string;
  tagName?: string;
  className?: string;
  textFingerprint?: string;
  src?: string;
  original?: string;
  rect?: VisualRect;
  styles?: VisualComputedStyles;
  source?: {
    file?: string;
    startLine?: number;
    endLine?: number;
  };
};

export type ComponentTemplate = {
  id: string;
  label: string;
  kind: VisualComponentKind;
  defaultJsx: string;
  defaultStyles: VisualComputedStyles;
  allowedParents: VisualComponentKind[];
  editableProps: Array<{
    name: string;
    label: string;
    kind: "text" | "number" | "color" | "select" | "asset" | "boolean";
    target: "prop" | "style" | "className" | "children";
  }>;
};

export type VisualEditOperation =
  | { type: "node.select"; target: VisualTarget }
  | { type: "text.update"; target: VisualTarget; value: string }
  | { type: "style.update"; target: VisualTarget; style: VisualComputedStyles }
  | { type: "asset.replace"; target: VisualTarget; asset: { id?: string; src: string; name?: string; kind: "image" | "video" } }
  | { type: "node.delete"; target: VisualTarget }
  | { type: "node.insert"; target: VisualTarget; position: VisualInsertPosition; componentTemplate: ComponentTemplate }
  | { type: "node.duplicate"; target: VisualTarget }
  | { type: "node.move"; target: VisualTarget; x: number; y: number }
  | { type: "node.resize"; target: VisualTarget; width: number; height: number; handle: VisualResizeHandle }
  | { type: "node.rotate"; target: VisualTarget; rotate: number };

export type VisualPatchMapperResult = {
  ok: boolean;
  content: string;
  operation: VisualEditOperation;
  summary: string;
  sourceFound: boolean;
};
