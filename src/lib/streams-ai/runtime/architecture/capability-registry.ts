export type RuntimeCapability = {
  name: string;
  available: boolean;
  actions: string[];
  authoritative: boolean;
};

export function getRuntimeCapabilityManifest() {
  const previewAvailable = true;
  const builderAvailable = Boolean(process.env.OPENAI_API_KEY);
  return {
    version: "streams-runtime-capabilities-v1",
    generatedAt: new Date().toISOString(),
    capabilities: {
      conversation: { name: "conversation", available: true, actions: ["respond", "explain_failure", "retry"], authoritative: true },
      websiteBuilder: { name: "websiteBuilder", available: builderAvailable, actions: ["create_frontend", "persist_source", "validate_html"], authoritative: true },
      preview: { name: "preview", available: previewAvailable, actions: ["create", "open", "read_status"], authoritative: true },
      workspace: { name: "workspace", available: true, actions: ["read", "write", "checkpoint"], authoritative: true },
      webSearch: { name: "webSearch", available: true, actions: ["search"], authoritative: false },
    } satisfies Record<string, RuntimeCapability>,
  };
}
