export type VersionGraphNode = {
  id: string;
  parentId: string | null;
  status: string;
  label: string;
  createdAt?: string | null;
};

export type VersionGraph = {
  originalVersionId: string | null;
  activeVersionId: string | null;
  nodes: VersionGraphNode[];
  edges: Array<{ from: string; to: string }>;
};

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

export function buildVersionGraph(raw: any): VersionGraph {
  const versions = asArray(raw?.versions || raw?.items || raw);
  const nodes: VersionGraphNode[] = versions.map((version: any, index: number) => ({
    id: String(version?.id || `version-${index + 1}`),
    parentId: version?.parentId || version?.parent_id || version?.sourceVersionId || null,
    status: String(version?.status || "unknown"),
    label: String(version?.change_summary || version?.summary || version?.label || `Version ${index + 1}`),
    createdAt: version?.createdAt || version?.created_at || null,
  }));

  const original = nodes.find((node) => node.status === "source" || node.parentId === null) || nodes[0] || null;
  const active = nodes.find((node) => node.status === "active" || node.status === "approved") || original;

  return {
    originalVersionId: original?.id || null,
    activeVersionId: active?.id || null,
    nodes,
    edges: nodes.filter((node) => node.parentId).map((node) => ({ from: String(node.parentId), to: node.id })),
  };
}
