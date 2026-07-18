import { connect } from "node:http2";
import { createPrivateKey, sign } from "node:crypto";

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function createJwt(input: { header: Record<string, unknown>; payload: Record<string, unknown>; privateKey: string; algorithm: "ES256" | "RS256" }) {
  const unsigned = `${base64Url(JSON.stringify(input.header))}.${base64Url(JSON.stringify(input.payload))}`;
  const signature = sign(input.algorithm === "ES256" ? "sha256" : "RSA-SHA256", Buffer.from(unsigned), {
    key: createPrivateKey(input.privateKey),
    dsaEncoding: input.algorithm === "ES256" ? "ieee-p1363" : undefined,
  });
  return `${unsigned}.${base64Url(signature)}`;
}

export type PushPayload = {
  title: string;
  body: string;
  deepLink?: string | null;
  data?: Record<string, unknown>;
};

export type PushDeliveryResult = { ok: boolean; providerMessageId?: string | null; statusCode?: number; error?: string | null; retryable?: boolean };

async function sendApns(token: string, payload: PushPayload): Promise<PushDeliveryResult> {
  const teamId = process.env.STREAMS_APNS_TEAM_ID?.trim();
  const keyId = process.env.STREAMS_APNS_KEY_ID?.trim();
  const bundleId = process.env.STREAMS_APNS_BUNDLE_ID?.trim();
  const privateKey = process.env.STREAMS_APNS_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  if (!teamId || !keyId || !bundleId || !privateKey) return { ok: false, error: "APNs credentials are not configured", retryable: false };
  const now = Math.floor(Date.now() / 1000);
  const jwt = createJwt({ header: { alg: "ES256", kid: keyId }, payload: { iss: teamId, iat: now }, privateKey, algorithm: "ES256" });
  const origin = process.env.STREAMS_APNS_ENV === "sandbox" ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com";
  return new Promise((resolve) => {
    const client = connect(origin);
    client.on("error", (error) => resolve({ ok: false, error: error.message, retryable: true }));
    const request = client.request({
      ":method": "POST",
      ":path": `/3/device/${encodeURIComponent(token)}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    });
    const chunks: Buffer[] = [];
    let status = 0;
    let apnsId = "";
    request.on("response", (headers) => {
      status = Number(headers[":status"] || 0);
      apnsId = String(headers["apns-id"] || "");
    });
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => {
      client.close();
      const body = Buffer.concat(chunks).toString("utf8");
      if (status >= 200 && status < 300) resolve({ ok: true, providerMessageId: apnsId || null, statusCode: status });
      else resolve({ ok: false, statusCode: status, error: body || `APNs returned ${status}`, retryable: status >= 500 || status === 429 });
    });
    request.on("error", (error) => { client.close(); resolve({ ok: false, error: error.message, retryable: true }); });
    request.end(JSON.stringify({ aps: { alert: { title: payload.title, body: payload.body }, sound: "default" }, deepLink: payload.deepLink || undefined, ...(payload.data || {}) }));
  });
}

async function googleAccessToken() {
  const raw = process.env.STREAMS_FCM_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) throw new Error("FCM service account is not configured");
  const account = JSON.parse(raw) as { client_email: string; private_key: string; token_uri?: string; project_id: string };
  const now = Math.floor(Date.now() / 1000);
  const assertion = createJwt({
    header: { alg: "RS256", typ: "JWT" },
    payload: { iss: account.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: account.token_uri || "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 },
    privateKey: account.private_key,
    algorithm: "RS256",
  });
  const response = await fetch(account.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const payload = await response.json().catch(() => ({})) as { access_token?: string; error_description?: string };
  if (!response.ok || !payload.access_token) throw new Error(payload.error_description || `FCM OAuth returned ${response.status}`);
  return { token: payload.access_token, projectId: account.project_id };
}

async function sendFcm(token: string, payload: PushPayload): Promise<PushDeliveryResult> {
  try {
    const auth = await googleAccessToken();
    const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(auth.projectId)}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message: { token, notification: { title: payload.title, body: payload.body }, data: Object.fromEntries(Object.entries({ deepLink: payload.deepLink || "", ...(payload.data || {}) }).map(([key, value]) => [key, typeof value === "string" ? value : JSON.stringify(value)])) } }),
    });
    const data = await response.json().catch(() => ({})) as { name?: string; error?: { message?: string; status?: string } };
    if (response.ok) return { ok: true, providerMessageId: data.name || null, statusCode: response.status };
    return { ok: false, statusCode: response.status, error: data.error?.message || `FCM returned ${response.status}`, retryable: response.status >= 500 || response.status === 429 };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "FCM delivery failed", retryable: true };
  }
}

export async function sendPushNotification(input: { provider: "apns" | "fcm" | "webpush"; token: string; payload: PushPayload }): Promise<PushDeliveryResult> {
  if (input.provider === "apns") return sendApns(input.token, input.payload);
  if (input.provider === "fcm") return sendFcm(input.token, input.payload);
  return { ok: false, error: "Web Push provider is not configured", retryable: false };
}
