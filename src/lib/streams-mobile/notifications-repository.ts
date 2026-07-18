import type { StreamsAIScope } from "@/lib/streams-ai/auth";
import { createStreamsAIServiceClient, streamsAISchema, streamsAITables } from "@/lib/streams-ai/server";
import { sanitizeStreamsAIPayload, sanitizeStreamsAIText } from "@/lib/streams-ai/protected-reasoning";
import { sendPushNotification } from "@/lib/streams-mobile/push-provider-service";

const TERMINAL_EVENT_TYPES = new Set([
  "operation_completed", "operation_failed", "failed", "blocked", "partial_completion", "cancelled",
  "preview.passed", "preview.failed", "verification.passed", "verification.failed",
  "approval.requested", "approval.approved", "approval.rejected",
  "github.push.passed", "github.push.failed", "github.pr.created", "github.merge.passed", "deployment.passed",
]);

function safeDeepLink(value?: string | null) {
  const text = String(value || "").trim();
  if (!text) return null;
  if (!text.startsWith("/") || text.startsWith("//") || text.includes("\\")) throw new Error("deepLink must be an internal absolute path");
  return text.slice(0, 1000);
}

export class StreamsNotificationsRepository {
  private db() { return streamsAISchema(createStreamsAIServiceClient()); }

  async list(scope: StreamsAIScope, limit = 100) {
    const { data, error } = await this.db().from(streamsAITables.pushDeliveries).select("*")
      .eq("tenant_id", scope.tenantId).eq("user_id", scope.userId)
      .order("created_at", { ascending: false }).limit(Math.max(1, Math.min(limit, 250)));
    if (error) throw new Error(`Failed to list Streams notifications: ${error.message}`);
    return data || [];
  }

  async preferences(scope: StreamsAIScope) {
    const { data, error } = await this.db().from(streamsAITables.notificationPreferences).select("*")
      .eq("tenant_id", scope.tenantId).eq("user_id", scope.userId).order("channel").order("event_type");
    if (error) throw new Error(`Failed to list Streams notification preferences: ${error.message}`);
    return data || [];
  }

  async updatePreference(scope: StreamsAIScope, input: { channel: "push" | "email" | "in_app"; eventType?: string; enabled: boolean; quietHours?: Record<string, unknown>; metadata?: Record<string, unknown> }) {
    const { data, error } = await this.db().from(streamsAITables.notificationPreferences).upsert({
      tenant_id: scope.tenantId,
      user_id: scope.userId,
      channel: input.channel,
      event_type: sanitizeStreamsAIText(input.eventType || "*", 200),
      enabled: input.enabled,
      quiet_hours: sanitizeStreamsAIPayload(input.quietHours || {}),
      metadata: sanitizeStreamsAIPayload(input.metadata || {}),
      updated_at: new Date().toISOString(),
    }, { onConflict: "tenant_id,user_id,channel,event_type" }).select("*").single();
    if (error) throw new Error(`Failed to update Streams notification preference: ${error.message}`);
    return data;
  }

  private async pushAllowed(scope: StreamsAIScope, eventType: string) {
    const preferences = await this.preferences(scope);
    const exact = preferences.find((row: any) => row.channel === "push" && row.event_type === eventType);
    const wildcard = preferences.find((row: any) => row.channel === "push" && row.event_type === "*");
    const selected: any = exact || wildcard;
    return selected ? selected.enabled !== false : true;
  }

  async queue(scope: StreamsAIScope, input: {
    eventType: string;
    title: string;
    body: string;
    deepLink?: string | null;
    jobId?: string | null;
    eventId?: string | null;
    notificationId?: string | null;
    data?: Record<string, unknown>;
  }) {
    const allowed = await this.pushAllowed(scope, input.eventType);
    const { data: devices, error: deviceError } = await this.db().from(streamsAITables.devices).select("id,push_provider,push_token")
      .eq("tenant_id", scope.tenantId).eq("user_id", scope.userId).eq("status", "active").not("push_token", "is", null);
    if (deviceError) throw new Error(`Failed to resolve notification devices: ${deviceError.message}`);
    const rows = (devices || []).map((device: any) => ({
      tenant_id: scope.tenantId,
      user_id: scope.userId,
      device_id: device.id,
      job_id: input.jobId || null,
      event_id: input.eventId || null,
      notification_id: input.notificationId || null,
      provider: device.push_provider,
      event_type: sanitizeStreamsAIText(input.eventType, 200),
      title: sanitizeStreamsAIText(input.title, 300),
      body: sanitizeStreamsAIText(input.body, 2000),
      deep_link: safeDeepLink(input.deepLink),
      status: allowed ? "queued" : "suppressed",
      payload: sanitizeStreamsAIPayload({ ...(input.data || {}), pushToken: device.push_token }),
    }));
    if (!rows.length) return [];
    const { data, error } = await this.db().from(streamsAITables.pushDeliveries).insert(rows).select("*");
    if (error) throw new Error(`Failed to queue Streams notifications: ${error.message}`);
    return data || [];
  }

  async deliver(scope: StreamsAIScope, deliveryId: string) {
    const { data: delivery, error } = await this.db().from(streamsAITables.pushDeliveries).select("*")
      .eq("tenant_id", scope.tenantId).eq("user_id", scope.userId).eq("id", deliveryId).maybeSingle();
    if (error) throw new Error(`Failed to read Streams push delivery: ${error.message}`);
    if (!delivery) throw new Error("Push delivery not found");
    if (delivery.status === "delivered" || delivery.status === "suppressed") return delivery;
    const payload = delivery.payload && typeof delivery.payload === "object" ? delivery.payload as Record<string, any> : {};
    const token = String(payload.pushToken || "");
    if (!token) throw new Error("Push token is unavailable for this delivery");
    await this.db().from(streamsAITables.pushDeliveries).update({ status: "sending", attempt_count: Number(delivery.attempt_count || 0) + 1, updated_at: new Date().toISOString() })
      .eq("tenant_id", scope.tenantId).eq("user_id", scope.userId).eq("id", deliveryId);
    const result = await sendPushNotification({ provider: delivery.provider, token, payload: { title: delivery.title, body: delivery.body, deepLink: delivery.deep_link, data: Object.fromEntries(Object.entries(payload).filter(([key]) => key !== "pushToken")) } });
    const now = new Date().toISOString();
    const nextAttempt = result.ok || result.retryable === false ? null : new Date(Date.now() + Math.min(3600_000, 30_000 * Math.max(1, Number(delivery.attempt_count || 0) + 1))).toISOString();
    const { data: updated, error: updateError } = await this.db().from(streamsAITables.pushDeliveries).update({
      status: result.ok ? "delivered" : "failed",
      provider_message_id: result.providerMessageId || null,
      last_error: result.error || null,
      next_attempt_at: nextAttempt,
      delivered_at: result.ok ? now : null,
      updated_at: now,
    }).eq("tenant_id", scope.tenantId).eq("user_id", scope.userId).eq("id", deliveryId).select("*").single();
    if (updateError) throw new Error(`Failed to update Streams push delivery: ${updateError.message}`);
    return updated;
  }

  async recordReceipt(scope: StreamsAIScope, deliveryId: string) {
    const { data, error } = await this.db().from(streamsAITables.pushDeliveries).update({ receipt_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("tenant_id", scope.tenantId).eq("user_id", scope.userId).eq("id", deliveryId).select("*").single();
    if (error) throw new Error(`Failed to record Streams push receipt: ${error.message}`);
    return data;
  }

  async queueFromJobEvent(scope: StreamsAIScope, input: { job: any; event: any }) {
    const eventType = String(input.event?.event_type || "");
    if (!TERMINAL_EVENT_TYPES.has(eventType)) return [];
    const projectId = input.job?.project_id || input.job?.input_json?.projectId || "";
    const data = input.event?.data && typeof input.event.data === "object" ? input.event.data : {};
    const title = eventType.includes("failed") ? "Streams action needs attention" : eventType.includes("approval.requested") ? "Streams approval requested" : "Streams action updated";
    const body = sanitizeStreamsAIText(input.event?.message || `Streams reported ${eventType}.`, 500);
    const deepLink = projectId ? `/streams-ai/streams-builder?projectId=${encodeURIComponent(projectId)}` : "/streams-ai";
    return this.queue(scope, { eventType, title, body, deepLink, jobId: input.job.id, eventId: input.event.id, data: { projectId, sequenceNumber: data.sequenceNumber || null } });
  }
}
