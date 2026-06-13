import "server-only";

export type ReadinessState = "ready" | "partial" | "missing" | "disabled";

export type CapabilityGroup =
  | "chat"
  | "builder"
  | "admingeneration"
  | "voice"
  | "storage"
  | "auth";

export type CapabilityId =
  | "chat-core"
  | "chat-uploads"
  | "builder-repair-loop"
  | "builder-github"
  | "builder-vercel"
  | "builder-proof"
  | "gen-admin-jobs"
  | "gen-text-to-image-openai"
  | "gen-text-to-image-fal"
  | "gen-image-to-video-runway"
  | "gen-image-to-video-kling"
  | "gen-image-to-video-veo"
  | "gen-text-to-video-runway"
  | "gen-text-to-video-kling"
  | "gen-text-to-video-veo"
  | "gen-voice-elevenlabs"
  | "gen-voice-openai"
  | "supabase-core";

export type EnvRequirement = {
  label: string;
  anyOf: string[];
};

export type CapabilityDefinition = {
  id: CapabilityId;
  label: string;
  group: CapabilityGroup;
  enabledByDefault?: boolean;
  required: EnvRequirement[];
  optional?: EnvRequirement[];
};

export type CapabilityReadiness = {
  id: CapabilityId;
  label: string;
  group: CapabilityGroup;
  state: ReadinessState;
  enabled: boolean;
  satisfied: string[];
  missing: string[];
  optionalMissing: string[];
};

export type EnvReadinessReport = {
  ok: boolean;
  generatedAt: string;
  groups: Record<CapabilityGroup, { ok: boolean; items: CapabilityReadiness[] }>;
  capabilities: CapabilityReadiness[];
};

function hasEnv(name: string): boolean {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0;
}

function resolveRequirement(req: EnvRequirement) {
  const satisfied = req.anyOf.filter(hasEnv);
  return {
    ok: satisfied.length > 0,
    satisfied,
    missing: satisfied.length > 0 ? [] : req.anyOf,
  };
}

const CAPABILITIES: CapabilityDefinition[] = [
  {
    id: "chat-core",
    label: "Chat Core",
    group: "chat",
    required: [
      { label: "OpenAI model access", anyOf: ["OPENAI_API_KEY"] },
      { label: "OpenAI model selection", anyOf: ["OPENAI_MODEL"] },
    ],
  },
  {
    id: "chat-uploads",
    label: "Chat Uploads",
    group: "chat",
    required: [
      { label: "Supabase URL", anyOf: ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"] },
      { label: "Supabase anon key", anyOf: ["NEXT_PUBLIC_SUPABASE_ANON_KEY"] },
      { label: "Supabase service role", anyOf: ["SUPABASE_SERVICE_ROLE_KEY"] },
    ],
  },
  {
    id: "supabase-core",
    label: "Supabase Core",
    group: "storage",
    required: [
      { label: "Supabase URL", anyOf: ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"] },
      { label: "Supabase service role", anyOf: ["SUPABASE_SERVICE_ROLE_KEY"] },
    ],
  },
  {
    id: "builder-repair-loop",
    label: "Builder Repair Loop",
    group: "builder",
    required: [
      { label: "Supabase service role", anyOf: ["SUPABASE_SERVICE_ROLE_KEY"] },
      { label: "Credential key", anyOf: ["STREAMS_CREDENTIAL_KEY"] },
      { label: "Connector encryption", anyOf: ["CONNECTOR_ENCRYPTION_KEY"] },
    ],
  },
  {
    id: "builder-github",
    label: "Builder GitHub Access",
    group: "builder",
    required: [
      { label: "GitHub token", anyOf: ["GITHUB_TOKEN", "GH_TOKEN"] },
      { label: "GitHub client id", anyOf: ["GITHUB_CLIENT_ID"] },
      { label: "GitHub client secret", anyOf: ["GITHUB_CLIENT_SECRET"] },
      { label: "GitHub callback url", anyOf: ["GITHUB_CALLBACK_URL"] },
    ],
  },
  {
    id: "builder-vercel",
    label: "Builder Vercel Access",
    group: "builder",
    required: [{ label: "Vercel token", anyOf: ["VERCEL_TOKEN"] }],
  },
  {
    id: "builder-proof",
    label: "Builder Proof / Browser Verification",
    group: "builder",
    required: [{ label: "Supabase service role", anyOf: ["SUPABASE_SERVICE_ROLE_KEY"] }],
  },
  {
    id: "gen-admin-jobs",
    label: "Admin Generation Jobs",
    group: "admingeneration",
    required: [{ label: "Admin generation key", anyOf: ["ADMIN_GENERATION_KEY"] }],
  },
  {
    id: "gen-text-to-image-openai",
    label: "Text to Image - OpenAI",
    group: "admingeneration",
    required: [{ label: "OpenAI images key", anyOf: ["OPENAI_API_KEY_IMAGES", "OPENAI_API_KEY"] }],
    optional: [{ label: "OpenAI image model", anyOf: ["OPENAI_IMAGE_MODEL"] }],
  },
  {
    id: "gen-text-to-image-fal",
    label: "Text to Image - fal.ai",
    group: "admingeneration",
    required: [{ label: "fal key", anyOf: ["FAL_API_KEY", "FAL_KEY"] }],
  },
  {
    id: "gen-image-to-video-runway",
    label: "Image to Video - Runway",
    group: "admingeneration",
    required: [{ label: "Runway key", anyOf: ["RUNWAY_API_KEY"] }],
  },
  {
    id: "gen-image-to-video-kling",
    label: "Image to Video - Kling",
    group: "admingeneration",
    required: [{ label: "Kling key", anyOf: ["KLING_API_KEY"] }],
    optional: [{ label: "Kling assess key", anyOf: ["KLING_ASSESS_API_KEY"] }],
  },
  {
    id: "gen-image-to-video-veo",
    label: "Image to Video - Veo",
    group: "admingeneration",
    required: [{ label: "Veo key", anyOf: ["VEO_API_KEY"] }],
  },
  {
    id: "gen-text-to-video-runway",
    label: "Text to Video - Runway",
    group: "admingeneration",
    required: [{ label: "Runway key", anyOf: ["RUNWAY_API_KEY"] }],
  },
  {
    id: "gen-text-to-video-kling",
    label: "Text to Video - Kling",
    group: "admingeneration",
    required: [{ label: "Kling key", anyOf: ["KLING_API_KEY"] }],
    optional: [{ label: "Kling assess key", anyOf: ["KLING_ASSESS_API_KEY"] }],
  },
  {
    id: "gen-text-to-video-veo",
    label: "Text to Video - Veo",
    group: "admingeneration",
    required: [{ label: "Veo key", anyOf: ["VEO_API_KEY"] }],
  },
  {
    id: "gen-voice-elevenlabs",
    label: "Voice - ElevenLabs",
    group: "voice",
    required: [{ label: "ElevenLabs key", anyOf: ["ELEVENLABS_API_KEY"] }],
  },
  {
    id: "gen-voice-openai",
    label: "Voice - OpenAI",
    group: "voice",
    required: [{ label: "OpenAI voice key", anyOf: ["OPENAI_API_KEY_VOICE", "OPENAI_API_KEY"] }],
  },
];

export function getCapabilityDefinitions(): CapabilityDefinition[] {
  return CAPABILITIES;
}

export function getEnvReadinessReport(): EnvReadinessReport {
  const capabilities = CAPABILITIES.map<CapabilityReadiness>((cap) => {
    const requiredResults = cap.required.map(resolveRequirement);
    const optionalResults = (cap.optional ?? []).map(resolveRequirement);

    const missing = requiredResults.flatMap((result) => result.missing);
    const satisfied = requiredResults.flatMap((result) => result.satisfied);
    const optionalMissing = optionalResults.flatMap((result) => result.missing);

    let state: ReadinessState = "ready";
    if (missing.length > 0 && satisfied.length === 0) state = "missing";
    else if (missing.length > 0) state = "partial";

    return {
      id: cap.id,
      label: cap.label,
      group: cap.group,
      enabled: cap.enabledByDefault ?? true,
      state,
      satisfied,
      missing,
      optionalMissing,
    };
  });

  const groupNames: CapabilityGroup[] = ["chat", "builder", "admingeneration", "voice", "storage", "auth"];

  const groups = Object.fromEntries(
    groupNames.map((group) => {
      const items = capabilities.filter((item) => item.group === group);
      const ok = items.every((item) => item.state === "ready" || item.state === "partial");
      return [group, { ok, items }];
    }),
  ) as EnvReadinessReport["groups"];

  const ok = capabilities.every((capability) => capability.state !== "missing");

  return {
    ok,
    generatedAt: new Date().toISOString(),
    groups,
    capabilities,
  };
}

export function getCapabilityReadiness(id: CapabilityId): CapabilityReadiness {
  const report = getEnvReadinessReport();
  const item = report.capabilities.find((capability) => capability.id === id);
  if (!item) throw new Error(`Unknown capability id: ${id}`);
  return item;
}
