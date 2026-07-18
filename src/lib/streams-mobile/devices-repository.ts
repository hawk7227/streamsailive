import type { StreamsAIScope } from "@/lib/streams-ai/auth";
import { createStreamsAIServiceClient, streamsAISchema, streamsAITables } from "@/lib/streams-ai/server";
import { sanitizeStreamsAIPayload, sanitizeStreamsAIText } from "@/lib/streams-ai/protected-reasoning";

export type StreamsDevicePlatform = "ios" | "android" | "web";
export type StreamsPushProvider = "apns" | "fcm" | "webpush";

export class StreamsDevicesRepository {
  private db() {
    return streamsAISchema(createStreamsAIServiceClient());
  }

  async list(scope: StreamsAIScope) {
    const { data, error } = await this.db()
      .from(streamsAITables.devices)
      .select("*")
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .order("last_active_at", { ascending: false });
    if (error) throw new Error(`Failed to list Streams devices: ${error.message}`);
    return data || [];
  }

  async get(scope: StreamsAIScope, deviceId: string) {
    const { data, error } = await this.db()
      .from(streamsAITables.devices)
      .select("*")
      .eq("tenant_id", scope.tenantId)
      .eq("user_id", scope.userId)
      .eq("id", deviceId)
      .maybeSingle();
    if (error) throw new Error(`Failed to read Streams device: ${error.message}`);
    return data || null;
  }

  async register(scope: StreamsAIScope, input: {
    installationId: string;
    platform: StreamsDevicePlatform;
    deviceName?: string | null;
    appVersion?: string | null;
    osVersion?: string | null;
    locale?: string | null;
    timezone?: string | null;
    pushProvider?: StreamsPushProvider | null;
    pushToken?: string | null;
    refreshTokenFamilyId?: string | null;
    metadata?: Record<string, unknown>;
    ipAddress?: string | null;
    userAgent?: string | null;
  }) {
    const installationId = sanitizeStreamsAIText(input.installationId, 300).trim();
    if (!installationId) throw new Error("installationId is required");
    const now = new Date().toISOString();
    const { data, error } = await this.db()
      .from(streamsAITables.devices)
      .upsert({
        tenant_id: scope.tenantId,
        user_id: scope.userId,
        installation_id: installationId,
        platform: input.platform,
        device_name: sanitizeStreamsAIText(input.deviceName || "", 300) || null,
        app_version: sanitizeStreamsAIText(input.appVersion || "", 100) || null,
        os_version: sanitizeStreamsAIText(input.osVersion || "", 100) || null,
        locale: sanitizeStreamsAIText(input.locale || "", 40) || null,
        timezone: sanitizeStreamsAIText(input.timezone || "", 100) || null,
        push_provider: input.pushProvider || null,
        push_token: sanitizeStreamsAIText(input.pushToken || "", 4096) || null,
        push_token_updated_at: input.pushToken ? now : null,
        refresh_token_family_id: sanitizeStreamsAIText(input.refreshTokenFamilyId || "", 300) || null,
        status: "active",
        last_active_at: now,
        revoked_at: null,
        metadata: sanitizeStreamsAIPayload(input.metadata || {}),
        updated_at: now,
      }, { onConflict: "tenant_id,user_id,installation_id" })
      .select("*")
      .single();
    if (error) throw new Error(`Failed to register Streams device: ${error.message}`);
    await this.recordSecurityEvent(scope, {
      deviceId: data.id,
      eventType: "device.registered",
      severity: "info",
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      data: { platform: input.platform, appVersion: input.appVersion || null },
    });
    return data;
  }

  async touch(scope: StreamsAIScope, deviceId: string, input: { appVersion?: string | null; osVersion?: string | null; pushProvider?: StreamsPushProvider | null; pushToken?: string | null }) {
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { last_active_at: now, updated_at: now };
    if (input.appVersion !== undefined) patch.app_version = sanitizeStreamsAIText(input.appVersion || "", 100) || null;
    if (input.osVersion !== undefined) patch.os_version = sanitizeStreamsAIText(input.osVersion || "", 100) || null;
    if (input.pushProvider !== undefined) patch.push_provider = input.pushProvider;
    if (input.pushToken !== undefined) {
      patch.push_token = sanitizeStreamsAIText(input.pushToken || "", 4096) || null;
      patch.push_token_updated_at = now;
    }
    const { data, error } = await this.db().from(streamsAITables.devices).update(patch)
      .eq("tenant_id", scope.tenantId).eq("user_id", scope.userId).eq("id", deviceId).eq("status", "active")
      .select("*").single();
    if (error) throw new Error(`Failed to update Streams device: ${error.message}`);
    return data;
  }

  async revoke(scope: StreamsAIScope, deviceId: string, reason = "user_revoked") {
    const now = new Date().toISOString();
    const { data, error } = await this.db().from(streamsAITables.devices).update({
      status: "revoked", revoked_at: now, push_token: null, refresh_token_family_id: null, updated_at: now,
      metadata: { revocationReason: sanitizeStreamsAIText(reason, 500) },
    }).eq("tenant_id", scope.tenantId).eq("user_id", scope.userId).eq("id", deviceId).select("*").single();
    if (error) throw new Error(`Failed to revoke Streams device: ${error.message}`);
    await this.recordSecurityEvent(scope, { deviceId, eventType: "device.revoked", severity: "warning", data: { reason } });
    return data;
  }

  async recordSecurityEvent(scope: StreamsAIScope, input: {
    deviceId?: string | null;
    eventType: string;
    severity?: "info" | "warning" | "critical";
    ipAddress?: string | null;
    userAgent?: string | null;
    data?: Record<string, unknown>;
  }) {
    const { data, error } = await this.db().from(streamsAITables.deviceSecurityEvents).insert({
      tenant_id: scope.tenantId,
      user_id: scope.userId,
      device_id: input.deviceId || null,
      event_type: sanitizeStreamsAIText(input.eventType, 200),
      severity: input.severity || "info",
      ip_address: input.ipAddress || null,
      user_agent: sanitizeStreamsAIText(input.userAgent || "", 1000) || null,
      data: sanitizeStreamsAIPayload(input.data || {}),
    }).select("*").single();
    if (error) throw new Error(`Failed to record Streams device security event: ${error.message}`);
    return data;
  }
}
