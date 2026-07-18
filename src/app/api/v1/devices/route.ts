import { type NextRequest, NextResponse } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";
import { StreamsDevicesRepository, type StreamsDevicePlatform, type StreamsPushProvider } from "@/lib/streams-mobile/devices-repository";
import { sanitizeStreamsAIPayload } from "@/lib/streams-ai/protected-reasoning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const devices = new StreamsDevicesRepository();
const PLATFORMS: StreamsDevicePlatform[] = ["ios", "android", "web"];
const PUSH_PROVIDERS: StreamsPushProvider[] = ["apns", "fcm", "webpush"];

function fail(error: unknown, status = 400) {
  return NextResponse.json({ ok: false, apiVersion: "v1", error: error instanceof Error ? error.message : "Unknown device error" }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const deviceId = request.nextUrl.searchParams.get("deviceId");
    if (deviceId) {
      const device = await devices.get(scope, deviceId);
      if (!device) return fail(new Error("Device not found"), 404);
      return NextResponse.json({ ok: true, apiVersion: "v1", device });
    }
    return NextResponse.json({ ok: true, apiVersion: "v1", devices: await devices.list(scope) });
  } catch (error) {
    return fail(error, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = sanitizeStreamsAIPayload(await request.json().catch(() => ({}))) as Record<string, any>;
    if (!body.installationId || !PLATFORMS.includes(body.platform)) return fail(new Error("installationId and a valid platform are required"));
    if (body.pushProvider && !PUSH_PROVIDERS.includes(body.pushProvider)) return fail(new Error("pushProvider must be apns, fcm, or webpush"));
    const device = await devices.register(scope, {
      installationId: body.installationId,
      platform: body.platform,
      deviceName: body.deviceName,
      appVersion: body.appVersion,
      osVersion: body.osVersion,
      locale: body.locale,
      timezone: body.timezone,
      pushProvider: body.pushProvider || null,
      pushToken: body.pushToken || null,
      refreshTokenFamilyId: body.refreshTokenFamilyId || null,
      metadata: body.metadata || {},
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      userAgent: request.headers.get("user-agent"),
    });
    return NextResponse.json({ ok: true, apiVersion: "v1", device }, { status: 201 });
  } catch (error) {
    return fail(error, 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const scope = await requireStreamsAIScope(request);
    const body = sanitizeStreamsAIPayload(await request.json().catch(() => ({}))) as Record<string, any>;
    if (!body.deviceId) return fail(new Error("deviceId is required"));
    if (body.action === "revoke") {
      const device = await devices.revoke(scope, body.deviceId, body.reason || "user_revoked");
      return NextResponse.json({ ok: true, apiVersion: "v1", device });
    }
    if (body.pushProvider && !PUSH_PROVIDERS.includes(body.pushProvider)) return fail(new Error("pushProvider must be apns, fcm, or webpush"));
    const device = await devices.touch(scope, body.deviceId, {
      appVersion: body.appVersion,
      osVersion: body.osVersion,
      pushProvider: body.pushProvider,
      pushToken: body.pushToken,
    });
    return NextResponse.json({ ok: true, apiVersion: "v1", device });
  } catch (error) {
    return fail(error, 500);
  }
}
