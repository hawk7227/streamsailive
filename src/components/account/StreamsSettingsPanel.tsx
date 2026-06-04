"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  STREAMS_SETTING_DEFINITIONS,
  STREAMS_SETTINGS_TABS,
  type StreamsSettingDefinition,
  type StreamsSettingsCategory,
} from "@/lib/streams-ai/settings-policy";
import styles from "./StreamsSettingsPanel.module.css";

type SettingValue = string | boolean | number | null;
type SettingItem = StreamsSettingDefinition & { value?: SettingValue; status?: string; updatedAt?: string | null };
type Props = { initialCategory?: StreamsSettingsCategory };

const ICONS: Record<string, string> = { gear: "⚙", bell: "◖", spark: "✦", apps: "⌘", clock: "◷", card: "▭", database: "▣", box: "▱", key: "⚿", family: "♙", life: "◎", user: "◉" };

const CATEGORY_GROUPS: Partial<Record<StreamsSettingsCategory, Array<{ title: string; keys: string[]; description?: string }>>> = {
  general: [
    { title: "Account safety", keys: ["mfaPrompt"], description: "High-impact security prompts stay visible without blocking normal setup." },
    { title: "Interface", keys: ["appearance", "contrast", "accentColor", "density"] },
    { title: "Language and voice", keys: ["language", "timezone", "dictation", "spokenLanguage", "voice", "separateVoice"] },
    { title: "Startup", keys: ["defaultLanding"] },
  ],
  notifications: [
    { title: "Work and responses", keys: ["responses", "codex", "projects", "schedules"] },
    { title: "Usage, billing, and security", keys: ["usage", "billing", "security"] },
    { title: "Suggestions", keys: ["pulseDaily", "recommendations", "quietHours"] },
  ],
  personalization: [
    { title: "Style and tone", keys: ["baseStyleTone", "warm", "enthusiastic", "headersLists", "emoji", "fastAnswers", "customInstructions"] },
    { title: "About you", keys: ["nickname", "occupation", "moreAboutYou"] },
    { title: "Memory", keys: ["referenceSavedMemories", "referenceChatHistory", "memorySources", "manageMemory"] },
    { title: "Pulse", keys: ["memoryInSuggestions", "showPulse"] },
    { title: "Advanced", keys: ["webSearch", "canvas", "chatVoice", "advancedVoice", "connectorSearch", "temporaryChatDefault"] },
  ],
  apps: [
    { title: "Enabled apps", keys: ["enabledApps", "github", "googleWorkspace", "slack", "notion", "linearJira", "figmaCanva", "vercelSupabase"] },
    { title: "Permissions", keys: ["connectorSearch", "approvalMode", "revokeAll"] },
  ],
  schedules: [
    { title: "Tasks", keys: ["taskManagement", "taskSuggestions", "dailyBrief", "taskDigest"] },
    { title: "Automation", keys: ["recurringChecks", "scheduledWebResearch", "calendarSync", "defaultReminderChannel", "activeTaskLimit"] },
  ],
  billing: [
    { title: "Plan and billing", keys: ["billingCenter", "currentPlan", "paymentMethod", "invoiceDelivery", "billingAlerts"] },
    { title: "Usage credits", keys: ["usageCreditAutoReload", "reloadThreshold", "reloadAmount", "monthlySpendLimit"] },
  ],
  "data-controls": [
    { title: "History and training", keys: ["chatHistory", "temporaryChats", "trainingPreference", "chatRetention"] },
    { title: "Memory and connected data", keys: ["memoryDeletion", "fileLibraryData", "connectedAppData"] },
    { title: "Export and delete", keys: ["exportData", "deleteAccountData"] },
  ],
  storage: [
    { title: "Overview", keys: ["storageOverview"] },
    { title: "Retention", keys: ["fileLibraryRetention", "assetRetention", "downloadOriginals", "autoCleanup"] },
    { title: "Cleanup", keys: ["exportHistory", "clearCache"] },
  ],
  security: [
    { title: "Sign-in protection", keys: ["mfa", "passkeys", "password", "activeSessions", "loginAlerts"] },
    { title: "Builder and app safety", keys: ["highRiskApprovals", "builderSandbox", "connectedAppApprovals", "securityLog"] },
    { title: "Protected actions", keys: ["signOutEverywhere"] },
  ],
  "parental-controls": [
    { title: "Guardian setup", keys: ["teenMode", "guardianEmail"] },
    { title: "Restrictions", keys: ["contentRestrictions", "spendingControls", "timeWindows", "appRestrictions"] },
    { title: "Reports", keys: ["guardianReports"] },
  ],
  "trusted-contact": [
    { title: "Recovery contact", keys: ["contactEmail", "recoveryAllowed", "criticalAlerts", "spendLimitAlerts", "approvalDelay"] },
    { title: "Protected actions", keys: ["removeContact"] },
  ],
  account: [
    { title: "Identity", keys: ["displayName", "email", "phone", "workspaceName", "organization"] },
    { title: "Workspace", keys: ["role", "accountStatus", "downloadProfile"] },
    { title: "Lifecycle", keys: ["deleteAccount"] },
  ],
};

const TAB_ROUTES: Record<StreamsSettingsCategory, string> = {
  general: "/account",
  notifications: "/account/notifications",
  personalization: "/account/personalization",
  apps: "/account/apps",
  schedules: "/account/schedules",
  billing: "/account/billing",
  "data-controls": "/account/data-controls",
  storage: "/account/storage",
  security: "/account/security",
  "parental-controls": "/account/parental-controls",
  "trusted-contact": "/account/trusted-contact",
  account: "/account/profile",
};

function defaultSettings() { return STREAMS_SETTING_DEFINITIONS.map((item) => ({ ...item, value: item.defaultValue, status: "default" })); }
function visibleValue(value: unknown, fallback: unknown) { return value === undefined || value === null || value === "" ? fallback : value; }
function safeMessage(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "Settings are temporarily unavailable.";
  return value.replace(/\bAPI\b/gi, "account service").replace(/schema cache/gi, "account setup").replace(/schema/gi, "account setup").replace(/streams_ai_[a-z_]+/gi, "account record").replace(/backend/gi, "account system").replace(/table/gi, "account record").replace(/\/api\/[\w\-/]+/gi, "account service");
}
function actionNotice(setting: SettingItem) { return setting.type === "danger" ? `${setting.label} is protected. A verification step is required before this action can continue.` : `${setting.label} opened. Review the details below.`; }
function settingStatusLabel(setting: SettingItem, busy: boolean) { if (busy) return "Saving"; if (setting.type === "danger") return "Protected"; if (setting.type === "button") return String(setting.defaultValue || "Open"); return setting.status === "active" ? "Saved" : "Default"; }
function renderValuePreview(setting: SettingItem, value: unknown) { if (setting.type === "toggle") return Boolean(value) ? "On" : "Off"; if (setting.type === "button" || setting.type === "danger") return setting.actionLabel || "Open"; return String(value ?? setting.defaultValue ?? "").trim() || "Not set"; }
function nextSelectValue(setting: SettingItem, value: unknown) { const options = setting.options || []; if (!options.length) return String(value || setting.defaultValue || ""); const current = String(value ?? setting.defaultValue ?? options[0]); const index = options.indexOf(current); return options[(index + 1) % options.length] || options[0]; }

function ActionPanel({ setting, onClose }: { setting: SettingItem; onClose: () => void }) {
  const protectedAction = setting.type === "danger";
  return (
    <section className={styles.actionPanel} data-danger={protectedAction}>
      <div>
        <span>{protectedAction ? "Protected action" : "Account action"}</span>
        <h2>{setting.label}</h2>
        <p>{setting.description || "This setting uses a dedicated account flow."}</p>
        <div className={styles.actionPanelMeta}>
          <b>Category</b><strong>{setting.category.replace(/-/g, " ")}</strong>
          <b>Status</b><strong>{protectedAction ? "Verification required" : "Ready for dedicated flow"}</strong>
          <b>Current action</b><strong>{setting.actionLabel || "Open"}</strong>
        </div>
        <p className={styles.actionPanelNote}>{protectedAction ? "This is intentionally blocked until a real verification flow is connected. No destructive action was performed." : "This click is now live in the UI. The next production step is wiring this button to its real provider or account completion flow."}</p>
      </div>
      <button type="button" onClick={onClose}>Close</button>
    </section>
  );
}

export default function StreamsSettingsPanel({ initialCategory = "general" }: Props) {
  const [activeTab, setActiveTab] = useState<StreamsSettingsCategory>(initialCategory);
  const [settings, setSettings] = useState<SettingItem[]>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [activeAction, setActiveAction] = useState<SettingItem | null>(null);
  const activeMeta = useMemo(() => STREAMS_SETTINGS_TABS.find((tab) => tab.id === activeTab) || STREAMS_SETTINGS_TABS[0], [activeTab]);
  const activeSettings = useMemo(() => settings.filter((setting) => setting.category === activeTab), [settings, activeTab]);
  const activeGroups = CATEGORY_GROUPS[activeTab] || [{ title: activeMeta.title, keys: activeSettings.map((setting) => setting.key) }];

  const loadSettings = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/streams-ai/settings", { method: "GET", headers: { "Content-Type": "application/json" } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) throw new Error(data?.message || "Settings are temporarily unavailable.");
      if (Array.isArray(data.settings)) setSettings(data.settings);
    } catch (err) { setError(safeMessage(err instanceof Error ? err.message : "Settings are temporarily unavailable.")); }
    finally { setLoading(false); }
  }, []);

  async function saveSetting(setting: SettingItem, value: SettingValue) {
    if (setting.type === "button" || setting.type === "danger") { setActiveAction(setting); setNotice(actionNotice(setting)); setError(""); return; }
    setSavingKey(`${setting.category}:${setting.key}`); setError(""); setNotice("");
    const previous = settings;
    setSettings((current) => current.map((item) => item.category === setting.category && item.key === setting.key ? { ...item, value } : item));
    try {
      const response = await fetch("/api/streams-ai/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category: setting.category, key: setting.key, value }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) throw new Error(data?.message || "Setting could not be saved.");
      if (data.setting) setSettings((current) => current.map((item) => item.category === data.setting.category && item.key === data.setting.key ? { ...item, ...data.setting } : item));
      setNotice(`${setting.label} saved.`);
    } catch (err) { setSettings(previous); setError(safeMessage(err instanceof Error ? err.message : "Setting could not be saved.")); }
    finally { setSavingKey(""); }
  }

  function handleRowClick(setting: SettingItem, value: unknown) {
    if (savingKey === `${setting.category}:${setting.key}`) return;
    if (setting.type === "select") void saveSetting(setting, nextSelectValue(setting, value));
    if (setting.type === "toggle") void saveSetting(setting, !Boolean(value));
    if (setting.type === "button" || setting.type === "danger") void saveSetting(setting, String(value || setting.defaultValue));
  }

  useEffect(() => { void loadSettings(); }, [loadSettings]);

  return (
    <main className={styles.settingsShell}>
      <aside className={styles.settingsSide} aria-label="Settings sections">
        <Link className={styles.closeButton} href="/streams-ai" aria-label="Close settings">×</Link>
        <nav className={styles.tabList}>{STREAMS_SETTINGS_TABS.map((tab) => (
          <Link key={tab.id} className={styles.tabButton} data-active={activeTab === tab.id} href={TAB_ROUTES[tab.id] || "/account"} onClick={(event) => { event.preventDefault(); window.history.pushState(null, "", TAB_ROUTES[tab.id] || "/account"); setActiveTab(tab.id); setActiveAction(null); setNotice(""); setError(""); }}>
            <span className={styles.tabIcon}>{ICONS[tab.icon] || "•"}</span><span>{tab.label}</span>
          </Link>
        ))}</nav>
      </aside>
      <section className={styles.main}>
        <header className={styles.header}><div><p className={styles.eyebrow}>Streams settings</p><h1>{activeMeta.title}</h1><p>{activeMeta.description}</p></div><button type="button" className={styles.refreshButton} onClick={() => void loadSettings()} disabled={loading}>{loading ? "Syncing" : "Refresh"}</button></header>
        {loading ? <div className={styles.notice}>Loading saved settings…</div> : null}{notice ? <div className={styles.notice}>{notice}</div> : null}{error ? <div className={styles.error}>{error}</div> : null}{activeAction ? <ActionPanel setting={activeAction} onClose={() => setActiveAction(null)} /> : null}
        {activeTab === "general" ? <div className={styles.secureCard}><div><span>Recommended</span><h2>Secure your account</h2><p>Add multi-factor authentication before billing, deployments, app writes, and other protected builder actions.</p></div><button type="button" onClick={() => { const setting = settings.find((item) => item.key === "mfaPrompt") || activeSettings[0]; if (setting) void saveSetting(setting, String(setting.defaultValue || "Recommended")); }}>Set up MFA</button></div> : null}
        {activeTab === "apps" ? <div className={styles.infoCard}><span>Apps and connectors</span><p>Apps can provide context, search connected sources, or perform external actions. Read access, write access, sends, deletes, billing actions, and deploy actions should remain approval-gated.</p></div> : null}
        {activeTab === "data-controls" ? <div className={styles.infoCard}><span>Privacy model</span><p>Data controls separate chat history, memory, connected-source access, temporary chats, exports, and product-improvement preference instead of hiding everything behind one switch.</p></div> : null}
        {activeGroups.map((group) => {
          const groupSettings = group.keys.map((key) => activeSettings.find((setting) => setting.key === key)).filter((setting): setting is SettingItem => Boolean(setting));
          if (!groupSettings.length) return null;
          return <section className={styles.settingGroup} key={group.title}><div className={styles.groupHeader}><h2>{group.title}</h2>{group.description ? <p>{group.description}</p> : null}</div><div className={styles.settingList}>{groupSettings.map((setting) => {
            const value = visibleValue(setting.value, setting.defaultValue); const busy = savingKey === `${setting.category}:${setting.key}`; const preview = renderValuePreview(setting, value); const rowClickable = setting.type !== "text";
            return <div className={styles.settingRow} key={`${setting.category}:${setting.key}`} data-kind={setting.type} data-clickable={rowClickable} role={rowClickable ? "button" : undefined} tabIndex={rowClickable ? 0 : undefined} onClick={rowClickable ? () => handleRowClick(setting, value) : undefined} onKeyDown={rowClickable ? (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); handleRowClick(setting, value); } } : undefined}>
              <div className={styles.settingText}><h3>{setting.label}</h3>{setting.description ? <p>{setting.description}</p> : null}<div className={styles.saveState}>{settingStatusLabel(setting, busy)} · {preview}</div></div>
              {setting.type === "select" ? <button type="button" className={styles.selectButton} disabled={busy} onClick={(event) => { event.stopPropagation(); handleRowClick(setting, value); }}><span>{String(value)}</span><i>⌄</i></button> : null}
              {setting.type === "toggle" ? <button type="button" className={styles.toggle} data-on={Boolean(value)} aria-pressed={Boolean(value)} disabled={busy} onClick={(event) => { event.stopPropagation(); handleRowClick(setting, value); }}><span /></button> : null}
              {setting.type === "text" ? <input className={styles.textInput} value={String(value || "")} placeholder={String(setting.defaultValue || setting.label)} disabled={busy} onChange={(event) => setSettings((current) => current.map((item) => item.category === setting.category && item.key === setting.key ? { ...item, value: event.target.value } : item))} onBlur={(event) => void saveSetting(setting, event.target.value)} /> : null}
              {setting.type === "button" || setting.type === "danger" ? <button type="button" className={`${styles.actionButton} ${setting.type === "danger" ? styles.dangerButton : ""}`} onClick={(event) => { event.stopPropagation(); handleRowClick(setting, value); }}>{setting.actionLabel || String(value || "Open")}</button> : null}
            </div>;
          })}</div></section>;
        })}
      </section>
    </main>
  );
}
