import { createStreamsAIServiceClient, streamsAISchema, streamsAITables } from "../server";
import type { StreamsAIScope } from "../auth";
import {
  STREAMS_SETTING_DEFINITIONS,
  STREAMS_SETTINGS_TABS,
  getSettingDefinition,
  type StreamsSettingsCategory,
} from "../settings-policy";

type JsonValue = string | number | boolean | null | Record<string, unknown> | unknown[];

type SettingsRow = {
  category: string;
  setting_key: string;
  setting_value: JsonValue;
  status?: string;
  updated_at?: string;
};

function normalizeStoredValue(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value) && "value" in (value as Record<string, unknown>)) {
    return (value as Record<string, unknown>).value as JsonValue;
  }
  return value as JsonValue;
}

export class StreamsAISettingsRepository {
  private db() {
    return streamsAISchema(createStreamsAIServiceClient());
  }

  async list(scope: StreamsAIScope, category?: StreamsSettingsCategory | null) {
    let query = this.db()
      .from(streamsAITables.userSettings)
      .select("category,setting_key,setting_value,status,updated_at")
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId);

    if (category) query = query.eq("category", category);

    const { data, error } = await query;
    if (error) throw new Error(`Settings are not available yet: ${error.message}`);

    const stored = new Map<string, SettingsRow>();
    for (const row of (data || []) as SettingsRow[]) {
      stored.set(`${row.category}:${row.setting_key}`, row);
    }

    const definitions = category
      ? STREAMS_SETTING_DEFINITIONS.filter((definition) => definition.category === category)
      : STREAMS_SETTING_DEFINITIONS;

    return {
      ok: true,
      tabs: STREAMS_SETTINGS_TABS,
      settings: definitions.map((definition) => {
        const row = stored.get(`${definition.category}:${definition.key}`);
        return {
          ...definition,
          value: row ? normalizeStoredValue(row.setting_value) : definition.defaultValue,
          status: row?.status || "active",
          updatedAt: row?.updated_at || null,
        };
      }),
    };
  }

  async update(scope: StreamsAIScope, input: { category?: string; key?: string; value?: JsonValue }) {
    const definition = getSettingDefinition(String(input.category || ""), String(input.key || ""));
    if (!definition) throw new Error("Setting not found.");

    const nextValue = input.value ?? definition.defaultValue;
    if (definition.type === "select" && definition.options?.length && typeof nextValue === "string" && !definition.options.includes(nextValue)) {
      throw new Error("Setting value is not allowed.");
    }

    if (definition.type === "toggle" && typeof nextValue !== "boolean") {
      throw new Error("Setting value must be on or off.");
    }

    if (definition.type === "text" && typeof nextValue !== "string") {
      throw new Error("Setting value must be text.");
    }

    if (definition.type === "button" || definition.type === "danger") {
      throw new Error("This action is setup-ready but not connected to a completion flow yet.");
    }

    const { data, error } = await this.db()
      .from(streamsAITables.userSettings)
      .upsert(
        {
          tenant_id: scope.tenantId,
          user_id: scope.userId,
          category: definition.category,
          setting_key: definition.key,
          setting_value: { value: nextValue },
          status: "active",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id,user_id,category,setting_key" },
      )
      .select("category,setting_key,setting_value,status,updated_at")
      .single();

    if (error) throw new Error(`Setting could not be saved: ${error.message}`);

    return {
      ok: true,
      setting: {
        ...definition,
        value: normalizeStoredValue((data as SettingsRow).setting_value),
        status: (data as SettingsRow).status || "active",
        updatedAt: (data as SettingsRow).updated_at || null,
      },
    };
  }
}
