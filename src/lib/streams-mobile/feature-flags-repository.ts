import { createHash } from "node:crypto";
import type { StreamsAIScope } from "@/lib/streams-ai/auth";
import { createStreamsAIServiceClient, streamsAISchema, streamsAITables } from "@/lib/streams-ai/server";

export type StreamsFeaturePlatform = "web" | "ios" | "android";

function versionParts(value?: string | null) {
  return String(value || "0").split(/[.+-]/).slice(0, 4).map((part) => Number(part.replace(/\D/g, "")) || 0);
}

export function compareVersions(left?: string | null, right?: string | null) {
  const a = versionParts(left);
  const b = versionParts(right);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const delta = (a[index] || 0) - (b[index] || 0);
    if (delta !== 0) return delta > 0 ? 1 : -1;
  }
  return 0;
}

export function rolloutBucket(input: string) {
  const digest = createHash("sha256").update(input).digest();
  return digest.readUInt32BE(0) % 100;
}

export class StreamsFeatureFlagsRepository {
  private db() { return streamsAISchema(createStreamsAIServiceClient()); }

  async list(scope: StreamsAIScope, featureKey?: string | null) {
    let query = this.db().from(streamsAITables.featureFlags).select("*")
      .or(`tenant_id.is.null,tenant_id.eq.${scope.tenantId}`)
      .or(`user_id.is.null,user_id.eq.${scope.userId}`)
      .order("created_at", { ascending: true });
    if (featureKey) query = query.eq("feature_key", featureKey);
    const { data, error } = await query;
    if (error) throw new Error(`Failed to list Streams feature flags: ${error.message}`);
    return data || [];
  }

  async evaluate(scope: StreamsAIScope, input: {
    featureKey: string;
    platform: StreamsFeaturePlatform;
    appVersion?: string | null;
    planId?: string | null;
    region?: string | null;
    deviceId?: string | null;
    now?: Date;
  }) {
    const now = input.now || new Date();
    const rows = await this.list(scope, input.featureKey);
    const candidates = rows.filter((row: any) => {
      if (row.platform !== "*" && row.platform !== input.platform) return false;
      if (row.plan_id && row.plan_id !== input.planId) return false;
      if (row.region && row.region.toLowerCase() !== String(input.region || "").toLowerCase()) return false;
      if (row.device_id && row.device_id !== input.deviceId) return false;
      if (row.min_app_version && compareVersions(input.appVersion, row.min_app_version) < 0) return false;
      if (row.max_app_version && compareVersions(input.appVersion, row.max_app_version) > 0) return false;
      if (row.starts_at && now < new Date(row.starts_at)) return false;
      if (row.ends_at && now >= new Date(row.ends_at)) return false;
      return true;
    });
    const ranked = candidates.sort((a: any, b: any) => {
      const score = (row: any) => Number(Boolean(row.device_id)) * 16 + Number(Boolean(row.user_id)) * 8 + Number(Boolean(row.tenant_id)) * 4 + Number(Boolean(row.plan_id)) * 2 + Number(Boolean(row.region));
      return score(b) - score(a) || new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
    });
    const selected: any = ranked[0] || null;
    if (!selected) return { featureKey: input.featureKey, enabled: false, reason: "no_matching_flag", configuration: {} };
    if (selected.kill_switch) return { featureKey: input.featureKey, enabled: false, reason: "kill_switch", flagId: selected.id, configuration: selected.configuration || {} };
    if (!selected.enabled) return { featureKey: input.featureKey, enabled: false, reason: "disabled", flagId: selected.id, configuration: selected.configuration || {} };
    const subject = input.deviceId || scope.userId;
    const bucket = rolloutBucket(`${input.featureKey}:${subject}`);
    const enabled = bucket < Number(selected.rollout_percentage ?? 100);
    return { featureKey: input.featureKey, enabled, reason: enabled ? "enabled" : "rollout_excluded", flagId: selected.id, rolloutBucket: bucket, rolloutPercentage: selected.rollout_percentage, configuration: selected.configuration || {} };
  }
}
