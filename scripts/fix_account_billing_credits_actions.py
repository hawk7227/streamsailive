from pathlib import Path

ROOT = Path.cwd()

def read(path):
    return (ROOT / path).read_text(encoding="utf-8")

def write(path, text):
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")

client_path = "src/components/streams-ai/current-chat/new-face/runtime/streamsAccountActivityClient.js"
s = read(client_path)

if "function pickRedirectUrl" not in s:
    s = s.replace(
        '''async function readJson(response) {
  return response.json().catch(() => ({}));
}''',
        '''async function readJson(response) {
  return response.json().catch(() => ({}));
}

function pickRedirectUrl(data) {
  return (
    data?.url ||
    data?.portalUrl ||
    data?.checkoutUrl ||
    data?.redirectUrl ||
    data?.session?.url ||
    data?.data?.url ||
    ""
  );
}

function assertRedirectUrl(data, fallbackMessage) {
  const url = pickRedirectUrl(data);

  if (!url || typeof url !== "string") {
    throw new Error(fallbackMessage);
  }

  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.toString();
  } catch {
    throw new Error("Redirect URL returned by backend is invalid.");
  }
}'''
    )

def replace_block(text, start_marker, end_marker, replacement):
    start = text.find(start_marker)
    end = text.find(end_marker, start)
    if start == -1 or end == -1:
        raise SystemExit(f"Could not locate block: {start_marker}")
    return text[:start] + replacement + text[end:]

s = replace_block(
    s,
    "export async function fetchCreditsWithActivity() {",
    "\nexport async function openBillingPortalWithActivity",
    '''export async function fetchCreditsWithActivity() {
  emitCreditsActivity(STREAMS_ACTIVITY_PHASES.RUNNING, "Loading credits...");

  const response = await fetch("/api/streams-ai/credits", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  const data = await readJson(response);

  if (!response.ok || data?.ok === false) {
    const reason = data?.error || data?.details || "Credits loading failed.";
    emitCreditsActivity(STREAMS_ACTIVITY_PHASES.FAILED, reason);
    throw new Error(reason);
  }

  const normalized = {
    ...data,
    availableCredits:
      data?.availableCredits ??
      data?.available_credits ??
      data?.credits?.available ??
      data?.balance ??
      data?.balance_after ??
      null,
    monthlyIncludedCredits:
      data?.monthlyIncludedCredits ??
      data?.monthly_included_credits ??
      data?.credits?.monthlyIncluded ??
      null,
    reservedCredits:
      data?.reservedCredits ??
      data?.reserved_credits ??
      data?.credits?.reserved ??
      null,
    usedThisPeriod:
      data?.usedThisPeriod ??
      data?.used_this_period ??
      data?.usage?.usedThisPeriod ??
      null,
    raw: data,
  };

  emitCreditsActivity(STREAMS_ACTIVITY_PHASES.COMPLETE, "Credits loaded", normalized);
  return normalized;
}
'''
)

s = replace_block(
    s,
    "export async function openBillingPortalWithActivity() {",
    "\nexport async function startCheckoutWithActivity",
    '''export async function openBillingPortalWithActivity() {
  emitBillingActivity(STREAMS_ACTIVITY_PHASES.RUNNING, "Opening billing portal...");

  const response = await fetch("/api/stripe/portal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  const data = await readJson(response);

  if (!response.ok || data?.ok === false) {
    const reason = data?.error || data?.details || "Billing portal failed.";
    emitBillingActivity(STREAMS_ACTIVITY_PHASES.FAILED, reason);
    throw new Error(reason);
  }

  const url = assertRedirectUrl(data, "Billing portal did not return a redirect URL.");

  emitBillingActivity(STREAMS_ACTIVITY_PHASES.COMPLETE, "Billing portal redirect ready", {
    redirectUrl: url,
  });

  window.location.assign(url);
  return { ...data, redirectUrl: url };
}
'''
)

s = replace_block(
    s,
    "export async function startCheckoutWithActivity(payload = {}) {",
    "\nexport async function fetchProjectsWithActivity",
    '''export async function startCheckoutWithActivity(payload = {}) {
  emitBillingActivity(STREAMS_ACTIVITY_PHASES.RUNNING, "Starting checkout...", payload);

  const response = await fetch("/api/stripe/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await readJson(response);

  if (!response.ok || data?.ok === false) {
    const reason = data?.error || data?.details || "Checkout failed.";
    emitBillingActivity(STREAMS_ACTIVITY_PHASES.FAILED, reason, payload);
    throw new Error(reason);
  }

  const url = assertRedirectUrl(data, "Checkout did not return a redirect URL.");

  emitBillingActivity(STREAMS_ACTIVITY_PHASES.COMPLETE, "Checkout redirect ready", {
    ...payload,
    redirectUrl: url,
  });

  window.location.assign(url);
  return { ...data, redirectUrl: url };
}
'''
)

write(client_path, s)

panel_path = "src/components/account/StreamsAccountActionPanel.tsx"
p = read(panel_path)

if 'const [lastRedirect, setLastRedirect] = useState("");' not in p:
    p = p.replace(
        'const [lastAction, setLastAction] = useState("");\n  const [groupSessionId, setGroupSessionId] = useState("");',
        'const [lastAction, setLastAction] = useState("");\n  const [lastRedirect, setLastRedirect] = useState("");\n  const [groupSessionId, setGroupSessionId] = useState("");'
    )

if "function creditValue" not in p:
    p = p.replace(
        '''function summarize(value: unknown) {
  if (!value || typeof value !== "object") return "Not loaded";
  const object = value as Record<string, unknown>;
  if (typeof object.email === "string") return object.email;
  if (typeof object.plan === "string") return object.plan;
  if (typeof object.status === "string") return object.status;
  if (typeof object.ok === "boolean") return object.ok ? "Loaded" : "Error";
  return "Loaded";
}''',
        '''function summarize(value: unknown) {
  if (!value || typeof value !== "object") return "Not loaded";
  const object = value as Record<string, unknown>;
  if (typeof object.email === "string") return object.email;
  if (typeof object.plan === "string") return object.plan;
  if (typeof object.status === "string") return object.status;
  if (typeof object.ok === "boolean") return object.ok ? "Loaded" : "Error";
  return "Loaded";
}

function creditValue(value: unknown, key: string) {
  if (!value || typeof value !== "object") return "Not loaded";
  const object = value as Record<string, unknown>;
  const direct = object[key];

  if (direct === null || typeof direct === "undefined") return "Not returned";
  if (typeof direct === "number") return direct.toLocaleString();
  return String(direct);
}'''
    )

p = p.replace(
    '''await openBillingPortalWithActivity();
      setLastAction("Billing portal redirect started.");''',
    '''const result = await openBillingPortalWithActivity();
      setLastRedirect(result?.redirectUrl || "Redirect started");
      setLastAction("Billing portal redirect started.");'''
)

p = p.replace(
    '''await startCheckoutWithActivity({ source, product });
      setLastAction("Checkout redirect started.");''',
    '''const result = await startCheckoutWithActivity({ source, product });
      setLastRedirect(result?.redirectUrl || "Redirect started");
      setLastAction("Checkout redirect started.");'''
)

old_credit = '''<article><span>Credits</span><strong>{summarize(credits)}</strong><p>/api/streams-ai/credits + emitCreditsActivity</p></article>'''
new_credit = '''<article>
          <span>Credits</span>
          <strong>{creditValue(credits, "availableCredits")}</strong>
          <p>
            Available: {creditValue(credits, "availableCredits")} · Monthly: {creditValue(credits, "monthlyIncludedCredits")} · Reserved: {creditValue(credits, "reservedCredits")} · Used: {creditValue(credits, "usedThisPeriod")}
          </p>
        </article>'''

if old_credit in p:
    p = p.replace(old_credit, new_credit)

if "Last redirect" not in p:
    p = p.replace(
        '''<section className={styles.proofBar}><strong>Last action</strong><span>{lastAction || "No account action has run yet."}</span></section>''',
        '''<section className={styles.proofBar}><strong>Last action</strong><span>{lastAction || "No account action has run yet."}</span></section>

      <section className={styles.proofBar}><strong>Last redirect</strong><span>{lastRedirect || "No redirect has started yet."}</span></section>'''
    )

write(panel_path, p)

write("src/app/api/streams-ai/account/proof/route.ts", '''import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    checks: {
      billingPortalRoute: "/api/stripe/portal",
      checkoutRoute: "/api/stripe/checkout",
      creditsRoute: "/api/streams-ai/credits",
    },
    note: "Use the account UI buttons for authenticated browser proof. This route only confirms route names.",
  });
}
''')

print("Fixed billing portal redirect, checkout redirect, and credits live data proof UI.")
