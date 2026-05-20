"use client";

import React, { useEffect, useMemo, useState } from "react";
import "./same-scene-new-action-panel.css";
import {
  SAFE_FEATURE_COPY,
  SAME_SCENE_ACTIONS,
  MOTIVATION_TONES,
} from "../../runtime/snapPicClick/sameSceneNewAction";

const LIBRARY_KEY = "streams-ai.assets.cache.v1";

function readLibraryFiles() {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(LIBRARY_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isSupportedAsset(file) {
  const mime = String(file?.mimeType || "").toLowerCase();
  return mime.startsWith("image/") || mime.startsWith("video/");
}

function normalizeAsset(file) {
  return {
    id: file?.id || file?.storageUrl || file?.previewUrl || file?.name,
    name: file?.name || "Saved media",
    kind: file?.kind || (String(file?.mimeType || "").startsWith("video/") ? "video" : "image"),
    mimeType: file?.mimeType || "",
    previewUrl: file?.previewUrl || file?.storageUrl || file?.url || "",
    storageUrl: file?.storageUrl || file?.previewUrl || file?.url || "",
    url: file?.previewUrl || file?.storageUrl || file?.url || "",
    createdAt: file?.createdAt || "",
  };
}

export default function SameSceneNewActionPanel() {
  const [open, setOpen] = useState(false);
  const [library, setLibrary] = useState([]);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [actionId, setActionId] = useState("motivate_myself");
  const [toneId, setToneId] = useState("future_me_determination");
  const [topic, setTopic] = useState("");
  const [permissionConfirmed, setPermissionConfirmed] = useState(false);
  const [useVoiceStyle, setUseVoiceStyle] = useState(false);
  const [preserveFace, setPreserveFace] = useState(true);
  const [preserveOutfit, setPreserveOutfit] = useState(true);
  const [preserveSetting, setPreserveSetting] = useState(true);
  const [preserveCameraAngle, setPreserveCameraAngle] = useState(true);
  const [allowStyleChanges, setAllowStyleChanges] = useState(false);
  const [duration, setDuration] = useState(8);
  const [status, setStatus] = useState("Choose a saved photo or video.");
  const [plan, setPlan] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    const refresh = () => {
      const files = readLibraryFiles().filter(isSupportedAsset).map(normalizeAsset);
      setLibrary(files);
      if (!selectedAssetId && files[0]?.id) setSelectedAssetId(files[0].id);
    };
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("streams:videos-changed", refresh);
    window.addEventListener("streams:images-changed", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("streams:videos-changed", refresh);
      window.removeEventListener("streams:images-changed", refresh);
    };
  }, [open, selectedAssetId]);

  const selectedAsset = useMemo(() => library.find((item) => item.id === selectedAssetId) || null, [library, selectedAssetId]);
  const toneOptions = useMemo(() => {
    if (actionId === "motivate_myself") return MOTIVATION_TONES.filter((tone) => ["future_me_determination", "dark_motivation", "survival_mode", "soft_encouragement", "no_excuses"].includes(tone.id));
    return MOTIVATION_TONES;
  }, [actionId]);

  async function buildPlan() {
    if (!selectedAsset) {
      setStatus("Choose a saved photo or video first.");
      return;
    }
    setStatus("Building action plan…");
    try {
      const response = await fetch("/api/streams/same-scene/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset: selectedAsset,
          actionId,
          toneId,
          topic,
          duration,
          aspectRatio: "9:16",
          preserveFace,
          preserveOutfit,
          preserveSetting,
          preserveCameraAngle,
          allowStyleChanges,
          permissionConfirmed,
          useVoiceStyle,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) throw new Error(data?.error || "Failed to build plan.");
      setPlan(data);
      setStatus(data.canGenerate ? "Plan ready. Next step is generating the base video." : data.blockedReason || "Plan blocked.");
    } catch (error) {
      setStatus(error?.message || "Failed to build plan.");
    }
  }

  function sendPlanToGenerator() {
    if (!plan?.canGenerate) return;
    window.dispatchEvent(new CustomEvent("streams:same-scene-generate", { detail: {
      prompt: plan.prompt,
      model: "kling",
      mode: selectedAsset?.kind === "image" ? "i2v" : "t2v",
      imageUrl: selectedAsset?.kind === "image" ? selectedAsset.url : undefined,
      duration: plan.duration,
      aspectRatio: plan.aspectRatio,
      action: plan.action?.id,
      tone: plan.tone?.id,
      workflow: "same_scene_new_action",
      intent: plan.action?.id,
      overlays: plan.overlays,
      voiceoverScript: plan.voiceoverScript,
      sourceAsset: selectedAsset,
      preserve: plan.preserve,
    }}));
    setStatus("Plan sent to the existing video workflow.");
  }

  return (
    <>
      <button type="button" className="ssna-floating" onClick={() => setOpen(true)}>Same Scene</button>
      {open ? (
        <section className="ssna-panel" aria-label="Same Scene, New Action">
          <header className="ssna-header"><div><strong>{SAFE_FEATURE_COPY.title}</strong><span>{SAFE_FEATURE_COPY.description}</span></div><button type="button" onClick={() => setOpen(false)}>×</button></header>
          <div className="ssna-body">
            <div className="ssna-field"><label>Saved photo or video</label><select value={selectedAssetId} onChange={(event) => setSelectedAssetId(event.target.value)}><option value="">Choose media</option>{library.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></div>
            {selectedAsset ? <div className="ssna-preview">{selectedAsset.kind === "video" ? <video src={selectedAsset.previewUrl} controls playsInline /> : <img src={selectedAsset.previewUrl} alt={selectedAsset.name} />}</div> : null}
            <div className="ssna-grid"><div className="ssna-field"><label>Action</label><select value={actionId} onChange={(e) => setActionId(e.target.value)}>{SAME_SCENE_ACTIONS.map((action) => <option key={action.id} value={action.id}>{action.label}</option>)}</select></div><div className="ssna-field"><label>Tone</label><select value={toneId} onChange={(e) => setToneId(e.target.value)}>{toneOptions.map((tone) => <option key={tone.id} value={tone.id}>{tone.label}</option>)}</select></div></div>
            <div className="ssna-field"><label>What is this about?</label><textarea value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Example: I need motivation to keep building my business." /></div>
            <div className="ssna-grid"><div className="ssna-field"><label>Duration</label><select value={String(duration)} onChange={(e) => setDuration(Number(e.target.value))}><option value="6">6 sec</option><option value="8">8 sec</option><option value="10">10 sec</option></select></div><div className="ssna-field ssna-toggles"><label>Voice</label><label className="ssna-checkbox"><input type="checkbox" checked={useVoiceStyle} onChange={(e) => setUseVoiceStyle(e.target.checked)} />Use My Voice Style</label></div></div>
            <div className="ssna-options"><strong>Preserve</strong><div className="ssna-checkboxes"><label className="ssna-checkbox"><input type="checkbox" checked={preserveFace} onChange={(e) => setPreserveFace(e.target.checked)} />Face</label><label className="ssna-checkbox"><input type="checkbox" checked={preserveOutfit} onChange={(e) => setPreserveOutfit(e.target.checked)} />Outfit</label><label className="ssna-checkbox"><input type="checkbox" checked={preserveSetting} onChange={(e) => setPreserveSetting(e.target.checked)} />Setting</label><label className="ssna-checkbox"><input type="checkbox" checked={preserveCameraAngle} onChange={(e) => setPreserveCameraAngle(e.target.checked)} />Camera Angle</label><label className="ssna-checkbox"><input type="checkbox" checked={allowStyleChanges} onChange={(e) => setAllowStyleChanges(e.target.checked)} />Allow Style Changes</label></div></div>
            <div className="ssna-safety"><label className="ssna-checkbox"><input type="checkbox" checked={permissionConfirmed} onChange={(e) => setPermissionConfirmed(e.target.checked)} />I confirm this is my media or I have permission to use it.</label></div>
            <div className="ssna-actions"><button type="button" onClick={buildPlan}>Build Plan</button><button type="button" className="secondary" disabled={!plan?.canGenerate} onClick={sendPlanToGenerator}>Use Plan</button></div>
            <p className="ssna-status">{status}</p>
            {plan ? <div className="ssna-plan"><strong>Plan Preview</strong><div className="ssna-plan-section"><span>Action</span><p>{plan.action?.label}</p></div><div className="ssna-plan-section"><span>Tone</span><p>{plan.tone?.label || "Default"}</p></div><div className="ssna-plan-section"><span>Prompt</span><p>{plan.prompt}</p></div><div className="ssna-plan-section"><span>Voiceover</span><p>{plan.voiceoverScript || "None"}</p></div></div> : null}
          </div>
        </section>
      ) : null}
    </>
  );
}
