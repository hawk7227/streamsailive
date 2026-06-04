"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  STREAMS_SETTING_DEFINITIONS,
  STREAMS_SETTINGS_TABS,
  type StreamsSettingDefinition,
  type StreamsSettingsCategory,
} from "@/lib/streams-ai/settings-policy";
import styles from "./StreamsSettingsPanel.module.css";

type SettingValue = string | boolean | number | null;
type SettingItem = StreamsSettingDefinition & { value?: SettingValue; status?: string; updatedAt?: string | null };

type Props = {
  initialCategory?: StreamsSettingsCategory;
};

const ICONS: Record<string, string> = {
  gear: "⚙",
  bell: "◖",
  spark: "✦",
  apps: "⌘",
  clock: "◷",
  card: "▭",
  database: "▣",
  box: "▱",
  key: "⚿",
  life: "◎",
  user: "◉",
};

function defaultSettings() {
  return STREAMS_SETTING_DEFINITIONS.map((item) => ({ ...item, value: item.defaultValue, status: "default" }));
}

function visibleValue(value: unknown, fallback: unknown) {
  if (value === undefined || value === null || value === "") return fallback;
  return value;
}

function safeMessage(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "Settings could not be saved yet.";
  return value
    .replace(/\bAPI\b/g, "account control")
    .replace(/schema cache/gi, "account setup")
    .replace(/streams_ai_[a-z_]+/gi, "account record")
    .replace(/backend/gi, "account system");
}

export default function StreamsSettingsPanel({ initialCategory = "general" }: Props) {
  const [activeTab, setActiveTab] = useState<StreamsSettingsCategory>(initialCategory);
  const [settings, setSettings] = useState<SettingItem[]>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const activeMeta = useMemo(() => STREAMS_SETTINGS_TABS.find((tab) => tab.id === activeTab) || STREAMS_SETTINGS_TABS[0], [activeTab]);
  const activeSettings = useMemo(() => settings.filter((setting) => setting.category === activeTab), [settings, activeTab]);

  async function loadSettings() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/streams-ai/settings", { method: "GET", headers: { "Content-Type": "application/json" } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) throw new Error(data?.message || "Settings are not available yet.");
      if (Array.isArray(data.settings)) setSettings(data.settings);
    } catch (err) {
      setError(safeMessage(err instanceof Error ? err.message : "Settings are not available yet."));
    } finally {
      setLoading(false);
    }
  }

  async function saveSetting(setting: SettingItem, value: SettingValue) {
    if (setting.type === "button" || setting.type === "danger") {
      setNotice(`${setting.label} is setup-ready. This action needs its dedicated completion flow before it can run.`);
      return;
    }

    setSavingKey(`${setting.category}:${setting.key}`);
    setError("");
    setNotice("");
    const previous = settings;
    setSettings((current) => current.map((item) => item.category === setting.category && item.key === setting.key ? { ...item, value } : item));

    try {
      const response = await fetch("/api/streams-ai/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: setting.category, key: setting.key, value }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) throw new Error(data?.message || "Setting could not be saved.");
      if (data.setting) {
        setSettings((current) => current.map((item) => item.category === data.setting.category && item.key === data.setting.key ? { ...item, ...data.setting } : item));
      }
      setNotice(`${setting.label} saved.`);
    } catch (err) {
      setSettings(previous);
      setError(safeMessage(err instanceof Error ? err.message : "Setting could not be saved."));
    } finally {
      setSavingKey("");
    }
  }

  useEffect(() => {
    void loadSettings();
  }, []);

  return (
    <main className={styles.settingsShell}>
      <aside className={styles.settingsSide} aria-label="Settings sections">
        <Link className={styles.closeButton} href="/streams-ai" aria-label="Close settings">×</Link>
        <nav className={styles.tabList}>
          {STREAMS_SETTINGS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={styles.tabButton}
              data-active={activeTab === tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setNotice("");
                setError("");
              }}
            >
              <span className={styles.tabIcon}>{ICONS[tab.icon] || "•"}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <section className={styles.main}>
        <header className={styles.header}>
          <h1>{activeMeta.title}</h1>
          <p>{activeMeta.description}</p>
          {loading ? <div className={styles.notice}>Loading saved settings…</div> : null}
          {notice ? <div className={styles.notice}>{notice}</div> : null}
          {error ? <div className={styles.error}>{error}</div> : null}
        </header>

        {activeTab === "security" ? (
          <div className={styles.secureCard}>
            <h2>Secure your account</h2>
            <p>Add multi-factor authentication, review active sessions, and protect your account before high-risk actions.</p>
            <button type="button" onClick={() => setNotice("MFA setup is ready for the dedicated security completion flow.")}>Set up MFA</button>
          </div>
        ) : null}

        <div className={styles.settingList}>
          {activeSettings.map((setting) => {
            const value = visibleValue(setting.value, setting.defaultValue);
            const busy = savingKey === `${setting.category}:${setting.key}`;
            return (
              <div className={styles.settingRow} key={`${setting.category}:${setting.key}`}>
                <div className={styles.settingText}>
                  <h2>{setting.label}</h2>
                  {setting.description ? <p>{setting.description}</p> : null}
                  {setting.updatedAt ? <div className={styles.saveState}>Saved {new Date(setting.updatedAt).toLocaleString()}</div> : null}
                </div>

                {setting.type === "select" ? (
                  <select
                    className={styles.select}
                    value={String(value)}
                    disabled={busy}
                    onChange={(event) => void saveSetting(setting, event.target.value)}
                  >
                    {(setting.options || []).map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                ) : null}

                {setting.type === "toggle" ? (
                  <button
                    type="button"
                    className={styles.toggle}
                    data-on={Boolean(value)}
                    aria-pressed={Boolean(value)}
                    disabled={busy}
                    onClick={() => void saveSetting(setting, !Boolean(value))}
                  >
                    <span />
                  </button>
                ) : null}

                {setting.type === "text" ? (
                  <input
                    className={styles.textInput}
                    value={String(value || "")}
                    disabled={busy}
                    onChange={(event) => setSettings((current) => current.map((item) => item.category === setting.category && item.key === setting.key ? { ...item, value: event.target.value } : item))}
                    onBlur={(event) => void saveSetting(setting, event.target.value)}
                  />
                ) : null}

                {setting.type === "button" || setting.type === "danger" ? (
                  <button
                    type="button"
                    className={`${styles.actionButton} ${setting.type === "danger" ? styles.dangerButton : ""}`}
                    onClick={() => void saveSetting(setting, String(value || setting.defaultValue))}
                  >
                    {setting.actionLabel || String(value || "Open")}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
