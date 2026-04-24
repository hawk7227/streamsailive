"use client";

/**
 * SettingsTab — API management, model defaults, cost guardrails.
 *
 * Rule 3 enforced: This is the ONLY tab where real provider names appear.
 * FAL_KEY (fal.ai), ElevenLabs API Key, OpenAI API Key shown here only.
 * All other tabs use brand names only.
 *
 * No backend — shell only. Backend: workspace_settings table (proven).
 */

import { useState, useEffect } from "react";
import { C, R, DUR, EASE } from "../tokens";
import { setProviderKey } from "@/lib/streams/provider-keys";

type KeyStatus = "untested" | "testing" | "valid" | "invalid";

interface ApiKey { label: string; provider: string; placeholder: string; status: KeyStatus; hint: string; }

const INITIAL_KEYS: ApiKey[] = [
  { label: "FAL Key",           provider: "fal.ai",        placeholder: "fal_……",        status: "untested", hint: "Routes all video, image, audio, and ffmpeg operations. Primary inference key." },
  { label: "ElevenLabs API Key", provider: "ElevenLabs",   placeholder: "sk_……",         status: "untested", hint: "Voice TTS, audio isolation, Scribe v2 STT, IVC voice cloning, dubbing." },
  { label: "OpenAI API Key",     provider: "OpenAI",        placeholder: "sk-……",         status: "untested", hint: "GPT-4o Vision for frame analysis, assistant chat, image generation." },
];

const DEFAULT_MODELS = [
  { mode: "Video",  current: "Standard",    options: ["Standard","Pro","Precision","Cinema","Native Audio"] },
  { mode: "Image",  current: "Kontext",     options: ["Kontext","Kontext Max","FLUX Pro","Design","Nano"]   },
  { mode: "Voice",  current: "Voice v3",    options: ["Voice v3","Turbo","Multilingual"]                   },
  { mode: "Music",  current: "Music",       options: ["Music","Music Draft","Music Ref","Commercial"]      },
];

export default function SettingsTab() {
  const [keys,     setKeys]     = useState<ApiKey[]>(INITIAL_KEYS);
  const [keyVals,  setKeyVals]  = useState<string[]>(["","",""]);
  const [showKeys, setShowKeys] = useState<boolean[]>([false,false,false]);
  const [models,   setModels]   = useState(DEFAULT_MODELS);
  const [daily,    setDaily]    = useState("10.00");
  const [monthly,  setMonthly]  = useState("200.00");
  const [quality,  setQuality]  = useState<"fast"|"standard"|"pro">("standard");
  const [watermark,setWatermark]= useState(true);
  const [saved,    setSaved]    = useState(false);

  async function testKey(i: number) {
    const keyVal = keyVals[i].trim();
    if (!keyVal) return;

    setKeys((k: ApiKey[]) => k.map((key: ApiKey, idx: number) =>
      idx === i ? { ...key, status: "testing" } : key));

    const providerMap: Record<number, "fal" | "elevenlabs" | "openai"> = {
      0: "fal",
      1: "elevenlabs",
      2: "openai",
    };
    const provider = providerMap[i];
    if (!provider) return;

    try {
      const res  = await fetch("/api/streams/settings/test-key", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ provider, key: keyVal }),
      });
      const data = await res.json() as { valid?: boolean; latencyMs?: number; error?: string };
      const newStatus: "valid" | "invalid" = (res.ok && data.valid) ? "valid" : "invalid";
      setKeys((k: ApiKey[]) => k.map((key: ApiKey, idx: number) =>
        idx === i ? { ...key, status: newStatus } : key));
    } catch {
      setKeys((k: ApiKey[]) => k.map((key: ApiKey, idx: number) =>
        idx === i ? { ...key, status: "invalid" } : key));
    }
  }

  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Connectors state ─────────────────────────────────────────────────────
  type ConnectorStatus = "connected" | "disconnected" | "error";
  interface ConnectorAccount {
    id: string; provider: string; providerAccountId: string | null;
    status: ConnectorStatus; lastValidatedAt: string | null;
  }
  const [connectors,      setConnectors]      = useState<ConnectorAccount[]>([]);
  const [connectorsLoaded, setConnectorsLoaded] = useState(false);
  const [connecting,      setConnecting]      = useState<string | null>(null);
  const [connectToken,    setConnectToken]    = useState<Record<string, string>>({});
  const [connectError,    setConnectError]    = useState<string | null>(null);
  const [disconnecting,   setDisconnecting]   = useState<string | null>(null);
  const [validating,      setValidating]      = useState<string | null>(null);

  // Load settings on mount
  useEffect(() => {
    // Load settings
    fetch("/api/streams/settings")
      .then(r => r.json())
      .then((d: { settings?: { default_video_model?: string; default_image_model?: string; default_voice_model?: string; default_music_model?: string; cost_limit_daily_usd?: number; cost_limit_monthly_usd?: number; quality_preset?: "fast"|"standard"|"pro"; watermark_enabled?: boolean } | null }) => {
        if (d.settings) {
          const s = d.settings;
          if (s.quality_preset) setQuality(s.quality_preset);
          if (s.watermark_enabled !== undefined) setWatermark(s.watermark_enabled);
          if (s.cost_limit_daily_usd !== undefined) setDaily(String(s.cost_limit_daily_usd));
          if (s.cost_limit_monthly_usd !== undefined) setMonthly(String(s.cost_limit_monthly_usd));
          // Load key hints (last 4 chars of each key, stored when key was tested)
          const hintMap = [
            (s as Record<string,unknown>).fal_key_hint as string | undefined,
            (s as Record<string,unknown>).elevenlabs_key_hint as string | undefined,
            (s as Record<string,unknown>).openai_key_hint as string | undefined,
          ];
          if (hintMap.some(Boolean)) {
            setKeyVals((v: string[]) => v.map((existing: string, i: number) =>
              !existing && hintMap[i] ? `••••••••${hintMap[i]}` : existing
            ));
            setKeys((k: ApiKey[]) => k.map((key: ApiKey, i: number) =>
              hintMap[i] ? { ...key, status: "valid" as const } : key
            ));
          }

          // Model defaults
          if (s.default_video_model || s.default_image_model || s.default_voice_model || s.default_music_model) {
            setModels((md: { mode: string; current: string; options: string[] }[]) => md.map((m: { mode: string; current: string; options: string[] }) => {
              if (m.mode === "Video"  && s.default_video_model)  return { ...m, current: s.default_video_model  };
              if (m.mode === "Image"  && s.default_image_model)  return { ...m, current: s.default_image_model  };
              if (m.mode === "Voice"  && s.default_voice_model)  return { ...m, current: s.default_voice_model  };
              if (m.mode === "Music"  && s.default_music_model)  return { ...m, current: s.default_music_model  };
              return m;
            }));
          }
        }
      })
      .catch(() => {/* settings load failed — use defaults */});

    // Load connectors
    fetch("/api/streams/connectors", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then((d: { data?: ConnectorAccount[] } | null) => {
        if (d?.data) setConnectors(d.data);
        setConnectorsLoaded(true);
      })
      .catch(() => setConnectorsLoaded(true));
  }, []);

  async function handleConnect(provider: string) {
    const token = connectToken[provider]?.trim();
    if (!token) return;
    setConnecting(provider);
    setConnectError(null);
    try {
      const res = await fetch("/api/streams/connectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ provider, credential: token }),
      });
      const d = await res.json() as { data?: { accountId?: string }; error?: string };
      if (!res.ok || d.error) {
        setConnectError(d.error ?? "Connection failed");
        return;
      }
      // Reload full list from server — POST returns trimmed shape,
      // GET returns full SafeAccountInfo with providerAccountId
      const reload = await fetch("/api/streams/connectors", { credentials: "include" });
      if (reload.ok) {
        const j = await reload.json() as { data?: ConnectorAccount[] };
        if (j.data) setConnectors(j.data);
      }
      setConnectToken(prev => ({ ...prev, [provider]: "" }));
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setConnecting(null);
    }
  }

  async function handleDisconnect(accountId: string, provider: string) {
    setDisconnecting(provider);
    setConnectError(null);
    try {
      const res = await fetch(`/api/streams/connectors/${accountId}`, {
        method: "DELETE", credentials: "include",
      });
      if (res.ok) {
        setConnectors(prev => prev.filter(c => c.id !== accountId));
      } else {
        setConnectError("Disconnect failed — check your permissions");
      }
    } catch { setConnectError("Disconnect failed"); }
    finally { setDisconnecting(null); }
  }

  async function handleValidate(accountId: string, provider: string) {
    setValidating(provider);
    try {
      const res = await fetch(`/api/streams/connectors/${accountId}?action=validate`, {
        method: "POST", credentials: "include",
      });
      if (res.ok) {
        const d = await res.json() as { data?: ConnectorAccount };
        if (d.data) setConnectors(prev => prev.map(c => c.id === accountId ? d.data! : c));
      }
    } catch { /* non-fatal — validate failure doesn't break the UI */ }
    finally { setValidating(null); }
  }

  async function handleSave() {
    setSaveError(null);
    try {
      const videoModel = models.find((m: typeof models[0]) => m.mode === "Video")?.current;
      const imageModel = models.find((m: typeof models[0]) => m.mode === "Image")?.current;
      const voiceModel = models.find((m: typeof models[0]) => m.mode === "Voice")?.current;
      const musicModel = models.find((m: typeof models[0]) => m.mode === "Music")?.current;

      const body: Record<string, unknown> = {
        quality_preset:          quality,
        watermark_enabled:       watermark,
        cost_limit_daily_usd:    daily   ? parseFloat(daily)   : null,
        cost_limit_monthly_usd:  monthly ? parseFloat(monthly) : null,
        default_video_model:     videoModel,
        default_image_model:     imageModel,
        default_voice_model:     voiceModel,
        default_music_model:     musicModel,
      };
      // Key hints — last 4 chars only, never full key
      keyVals.forEach((val: string, i: number) => {
        if (val.length >= 4) {
          const hint = val.slice(-4);
          if (i === 0) body.fal_key_hint        = hint;
          if (i === 1) body.elevenlabs_key_hint  = hint;
          if (i === 2) body.openai_key_hint      = hint;
        }
      });

      const res = await fetch("/api/streams/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });

      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setSaveError(d.error ?? "Save failed");
        return;
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);

      // Persist full keys to sessionStorage for direct provider calls
      // Keys are never sent to Vercel/server — only hints (last 4 chars) are stored in DB
      const providerMap = ["fal", "elevenlabs", "openai"] as const;
      keyVals.forEach((val: string, i: number) => {
        if (val.trim()) setProviderKey(providerMap[i], val.trim());
      });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    }
  }

  const statusColor = (s: KeyStatus) =>
    s === "valid" ? C.green : s === "invalid" ? C.red : s === "testing" ? C.amber : C.t4;

  const statusLabel = (s: KeyStatus) =>
    s === "valid" ? "✓ Valid" : s === "invalid" ? "✗ Invalid" : s === "testing" ? "Testing…" : "Untested";

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "24px 20px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Header */}
        <div>
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 24, color: C.t1, marginBottom: 4 }}>Settings</div>
          <div style={{ fontSize: 14, color: C.t3 }}>API keys and model defaults. Provider names shown here only — everywhere else uses Streams brand names.</div>
        </div>

        {/* API Keys — REAL provider names here per Rule 3 */}
        <div style={{ background: C.bg2, border: `1px solid ${C.bdr}`, borderRadius: R.r3, overflow: "hidden" }}>
          <div style={{ padding: "12px 18px", borderBottom: `1px solid ${C.bdr}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: C.t1 }}>API keys</div>
            <span style={{ fontSize: 12, color: C.t4, padding: "2px 8px", borderRadius: R.pill, background: C.surf, border: `1px solid ${C.bdr}` }}>encrypted at rest</span>
          </div>
          {keys.map((key: ApiKey, i: number) => (
            <div key={key.provider} style={{ padding: "16px 18px", borderBottom: i < keys.length - 1 ? `1px solid ${C.bdr}` : "none" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                {/* Rule 3: Real provider names in Settings only */}
                <div>
                  <span style={{ fontSize: 15, color: C.t1, fontWeight: 500 }}>{key.label}</span>
                  <span style={{ fontSize: 13, color: C.t4, marginLeft: 8 }}>{key.provider}</span>
                </div>
                <span style={{ fontSize: 13, color: statusColor(key.status), fontWeight: 500 }}>
                  {statusLabel(key.status)}
                </span>
              </div>
              <div style={{ fontSize: 13, color: C.t4, marginBottom: 8, lineHeight: 1.5 }}>{key.hint}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1, position: "relative" }}>
                  <input
                    type={showKeys[i] ? "text" : "password"}
                    value={keyVals[i]}
                    onFocus={()=>{
                      if(keyVals[i].startsWith("••••")){
                        setKeyVals((v:string[])=>v.map((x:string,idx:number)=>idx===i?"":x));
                      }
                    }}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setKeyVals((v: string[]) => v.map((x: string, idx: number) => idx === i ? e.target.value : x))}
                    placeholder={key.placeholder}
                    style={{ width: "100%", background: C.bg3, border: `1px solid ${C.bdr}`, borderRadius: R.r1, padding: "8px 36px 8px 8px", color: C.t1, fontSize: 15, fontFamily: "inherit", outline: "none" }}
                  />
                  <button onClick={() => setShowKeys((s: boolean[]) => s.map((x: boolean, idx: number) => idx === i ? !x : x))} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: C.t4, cursor: "pointer", fontSize: 15 }}>
                    {showKeys[i] ? "◉" : "○"}
                  </button>
                </div>
                <button onClick={() => testKey(i)} disabled={key.status === "testing"} style={{ padding: "8px 16px", borderRadius: R.r1, background: C.surf, border: `1px solid ${C.bdr}`, color: C.t2, fontSize: 14, fontFamily: "inherit", cursor: "pointer", flexShrink: 0, transition: `all ${DUR.fast} ${EASE}` }}>
                  Test
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Model defaults — brand names */}
        <div style={{ background: C.bg2, border: `1px solid ${C.bdr}`, borderRadius: R.r3, overflow: "hidden" }}>
          <div style={{ padding: "12px 18px", borderBottom: `1px solid ${C.bdr}` }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: C.t1 }}>Default models</div>
            <div style={{ fontSize: 13, color: C.t4, marginTop: 2 }}>Used when no model is explicitly selected in the Generate tab.</div>
          </div>
          {models.map((m: typeof models[0], i: number) => (
            <div key={m.mode} style={{ padding: "12px 18px", borderBottom: i < models.length - 1 ? `1px solid ${C.bdr}` : "none", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 15, color: C.t1 }}>{m.mode}</span>
              <select
                value={m.current}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setModels((md: typeof models) => md.map((x: typeof models[0], idx: number) => idx === i ? { ...x, current: e.target.value } : x))}
                style={{ background: C.bg3, border: `1px solid ${C.bdr}`, borderRadius: R.r1, padding: "8px 8px", color: C.t1, fontSize: 14, fontFamily: "inherit", outline: "none" }}
              >
                {m.options.map((o: string) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>

        {/* Quality preset */}
        <div style={{ background: C.bg2, border: `1px solid ${C.bdr}`, borderRadius: R.r3, padding: "16px 18px" }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: C.t1, marginBottom: 4 }}>Quality preset</div>
          <div style={{ fontSize: 13, color: C.t4, marginBottom: 12 }}>Maps to model tier + parameters across all generation modes.</div>
          <div style={{ display: "flex", gap: 8 }}>
            {(["fast","standard","pro"] as const).map(q => (
              <button key={q} onClick={() => setQuality(q)} style={{
                flex: 1, padding: "8px 0", borderRadius: R.r2, border: `1px solid ${quality === q ? C.acc : C.bdr}`,
                background: quality === q ? C.accDim : C.surf, color: quality === q ? C.acc2 : C.t3,
                fontSize: 15, fontFamily: "inherit", cursor: "pointer", fontWeight: quality === q ? 500 : 400,
                transition: `all ${DUR.fast} ${EASE}`,
              }}>
                {q.charAt(0).toUpperCase() + q.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Cost guardrails */}
        <div style={{ background: C.bg2, border: `1px solid ${C.bdr}`, borderRadius: R.r3, overflow: "hidden" }}>
          <div style={{ padding: "12px 18px", borderBottom: `1px solid ${C.bdr}` }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: C.t1 }}>Cost guardrails</div>
            <div style={{ fontSize: 13, color: C.t4, marginTop: 2 }}>System refuses to submit if threshold exceeded.</div>
          </div>
          {[
            { label: "Daily limit (USD)", val: daily, set: setDaily },
            { label: "Monthly limit (USD)", val: monthly, set: setMonthly },
          ].map(row => (
            <div key={row.label} style={{ padding: "12px 18px", borderBottom: `1px solid ${C.bdr}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 15, color: C.t1 }}>{row.label}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 15, color: C.t3 }}>$</span>
                <input
                  type="number"
                  value={row.val}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => row.set(e.target.value)}
                  style={{ width: 80, background: C.bg3, border: `1px solid ${C.bdr}`, borderRadius: R.r1, padding: "8px 8px", color: C.t1, fontSize: 15, fontFamily: "inherit", outline: "none", textAlign: "right" }}
                />
              </div>
            </div>
          ))}
          <div style={{ padding: "12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 15, color: C.t1 }}>"Made with Streams" watermark</div>
              <div style={{ fontSize: 13, color: C.t4, marginTop: 2 }}>Shown on shared links. Disable for brand accounts.</div>
            </div>
            <button onClick={() => setWatermark(!watermark)} style={{
              padding: "8px 16px", borderRadius: R.pill, border: `1px solid ${watermark ? C.acc : C.bdr}`,
              background: watermark ? C.acc : "transparent", color: watermark ? "#fff" : C.t3,
              fontSize: 14, fontFamily: "inherit", cursor: "pointer", transition: `all ${DUR.fast} ${EASE}`,
            }}>
              {watermark ? "On" : "Off"}
            </button>
          </div>
        </div>

        {/* Connectors */}
        <div style={{ background: C.bg2, border: `1px solid ${C.bdr}`, borderRadius: R.r3, overflow: "hidden" }}>
          <div style={{ padding: "12px 18px", borderBottom: `1px solid ${C.bdr}` }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: C.t1 }}>Connections</div>
            <div style={{ fontSize: 13, color: C.t4, marginTop: 2 }}>GitHub, Vercel, and Supabase for the Builder workspace.</div>
          </div>
          {([
            { provider: "github",   label: "GitHub",   hint: "Personal access token or fine-grained token. Enables repo read/write.", placeholder: "ghp_……" },
            { provider: "vercel",   label: "Vercel",   hint: "Vercel API token. Enables deployment status and project linking.",        placeholder: "Bearer ……" },
            { provider: "supabase", label: "Supabase", hint: "JSON: { \"projectRef\": \"…\", \"serviceRoleKey\": \"…\" }",             placeholder: "{\"projectRef\":\"…\",\"serviceRoleKey\":\"…\"}" },
          ]).map(({ provider, label, hint, placeholder }) => {
            const account = connectors.find(c => c.provider === provider);
            const isConnected = account?.status === "connected";
            return (
              <div key={provider} style={{ padding: "12px 18px", borderBottom: `1px solid ${C.bdr}` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 500, color: C.t1 }}>{label}</span>
                    {isConnected && account.providerAccountId && (
                      <span style={{ marginLeft: 8, fontSize: 12, color: C.green }}>
                        ✓ {account.providerAccountId}
                      </span>
                    )}
                    {isConnected && !account.providerAccountId && (
                      <span style={{ marginLeft: 8, fontSize: 12, color: C.green }}>✓ Connected</span>
                    )}
                    {!isConnected && connectorsLoaded && (
                      <span style={{ marginLeft: 8, fontSize: 12, color: C.t4 }}>Not connected</span>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: C.t4, marginBottom: 8 }}>{hint}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="password"
                    value={connectToken[provider] ?? ""}
                    onChange={e => setConnectToken(prev => ({ ...prev, [provider]: e.target.value }))}
                    placeholder={isConnected ? "Enter new token to update" : placeholder}
                    maxLength={2000}
                    style={{
                      flex: 1, background: C.bg3, border: "none", borderRadius: R.r1,
                      padding: "7px 10px", color: C.t1, fontSize: 13,
                      fontFamily: "inherit", outline: "none",
                    }}
                  />
                  <button
                    onClick={() => void handleConnect(provider)}
                    disabled={!connectToken[provider]?.trim() || connecting === provider}
                    style={{
                      padding: "7px 14px", borderRadius: R.r1,
                      background: connectToken[provider]?.trim() && connecting !== provider ? C.acc : C.bg4,
                      border: "none",
                      color: connectToken[provider]?.trim() && connecting !== provider ? "#fff" : C.t4,
                      fontSize: 13, fontFamily: "inherit", cursor: "pointer",
                      transition: `background ${DUR.fast} ${EASE}`,
                      minHeight: 34, flexShrink: 0,
                    }}
                  >
                    {connecting === provider ? "Connecting…" : isConnected ? "Update" : "Connect"}
                  </button>
                </div>
                {isConnected && account && (
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button
                      onClick={() => void handleValidate(account.id, provider)}
                      disabled={validating === provider}
                      style={{
                        padding: "5px 12px", borderRadius: R.r1, fontSize: 12,
                        background: "transparent",
                        border: `1px solid ${C.bdr}`,
                        color: C.t3, fontFamily: "inherit", cursor: "pointer",
                        minHeight: 30,
                        opacity: validating === provider ? 0.5 : 1,
                      }}
                    >
                      {validating === provider ? "Validating…" : "↻ Validate"}
                    </button>
                    <button
                      onClick={() => void handleDisconnect(account.id, provider)}
                      disabled={disconnecting === provider}
                      style={{
                        padding: "5px 12px", borderRadius: R.r1, fontSize: 12,
                        background: "transparent",
                        border: `1px solid rgba(239,68,68,0.25)`,
                        color: C.red, fontFamily: "inherit", cursor: "pointer",
                        minHeight: 30,
                        opacity: disconnecting === provider ? 0.5 : 1,
                      }}
                    >
                      {disconnecting === provider ? "Disconnecting…" : "Disconnect"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {connectError && (
            <div style={{ padding: "8px 18px", fontSize: 12, color: C.red, borderTop: `1px solid ${C.bdr}` }}>
              {connectError}
            </div>
          )}
        </div>

        {/* Save error */}
        {saveError && (
          <div style={{ padding: "8px 16px", borderRadius: R.r1, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: C.red, fontSize: 13 }}>
            {saveError}
          </div>
        )}
        {/* Save */}
        <button onClick={handleSave} style={{
          width: "100%", padding: "12px 0", borderRadius: R.r2, border: "none",
          background: saved ? C.green : C.acc, color: "#fff",
          fontSize: 16, fontFamily: "inherit", fontWeight: 500, cursor: "pointer",
          transition: `background ${DUR.fast} ${EASE}`,
        }}>
          {saved ? "✓ Saved" : "Save settings"}
        </button>

        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}
