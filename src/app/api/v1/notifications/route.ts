import { type NextRequest, NextResponse } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { StreamsNotificationsRepository } from "@/lib/streams-mobile/notifications-repository";
import { sanitizeStreamsAIPayload } from "@/lib/streams-ai/protected-reasoning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const notifications = new StreamsNotificationsRepository();

function fail(error: unknown, status = 400) {
  return NextResponse.json({ ok: false, apiVersion: "v1", error: error instanceof Error ? error.message : "Unknown notification error" }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const view = request.nextUrl.searchParams.get("view") || "deliveries";
    if (view === "preferences") return NextResponse.json({ ok: true, apiVersion: "v1", preferences: await notifications.preferences(scope) });
    return NextResponse.json({ ok: true, apiVersion: "v1", deliveries: await notifications.list(scope, Number(request.nextUrl.searchParams.get("limit") || 100)) });
  } catch (error) {
    return fail(error, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = sanitizeStreamsAIPayload(await request.json().catch(() => ({}))) as Record<string, any>;
    if (body.action === "deliver") {
      if (!body.deliveryId) return fail(new Error("deliveryId is required"));
      return NextResponse.json({ ok: true, apiVersion: "v1", delivery: await notifications.deliver(scope, body.deliveryId) });
    }
    if (body.action === "receipt") {
      if (!body.deliveryId) return fail(new Error("deliveryId is required"));
      return NextResponse.json({ ok: true, apiVersion: "v1", delivery: await notifications.recordReceipt(scope, body.deliveryId) });
    }
    if (!body.eventType || !body.title || !body.body) return fail(new Error("eventType, title, and body are required"));
    const deliveries = await notifications.queue(scope, {
      eventType: body.eventType,
      title: body.title,
      body: body.body,
      deepLink: body.deepLink,
      jobId: body.jobId,
      eventId: body.eventId,
      notificationId: body.notificationId,
      data: body.data || {},
    });
    return NextResponse.json({ ok: true, apiVersion: "v1", deliveries }, { status: 201 });
  } catch (error) {
    return fail(error, 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = sanitizeStreamsAIPayload(await request.json().catch(() => ({}))) as Record<string, any>;
    if (!body.channel || typeof body.enabled !== "boolean") return fail(new Error("channel and enabled are required"));
    if (!["push", "email", "in_app"].includes(body.channel)) return fail(new Error("channel must be push, email, or in_app"));
    const preference = await notifications.updatePreference(scope, {
      channel: body.channel,
      eventType: body.eventType || "*",
      enabled: body.enabled,
      quietHours: body.quietHours || {},
      metadata: body.metadata || {},
    });
    return NextResponse.json({ ok: true, apiVersion: "v1", preference });
  } catch (error) {
    return fail(error, 500);
  }
}
