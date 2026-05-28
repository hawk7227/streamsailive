"use client";

import { useEffect, useMemo, useState } from "react";
import "./opus-locked-frame.css";

const BOARD_WIDTH = 1920;
const BOARD_HEIGHT = 780;

const studios = [
  {
    id: "text-to-image",
    title: "Text to Image",
    desc: "Generate stunning images from text",
    icon: "🖼️",
    tone: "blue",
    kind: "image",
    provider: "openai",
    duration: "N/A",
    aspectRatio: "1:1",
    style: "Product Visual",
    prompt:
      "Create a premium cinematic product image with dark glass UI, realistic studio lighting, and a polished commercial look.",
    summary:
      "A high-end still image workflow for brand visuals, product shots, thumbnails, concepts, and campaign creative.",
  },
  {
    id: "image-to-video",
    title: "Image to Video",
    desc: "Turn images into dynamic videos",
    icon: "🎞️",
    tone: "purple",
    kind: "image-to-video",
    provider: "fal",
    duration: "8s",
    aspectRatio: "16:9",
    style: "Cinematic",
    prompt:
      "A lone female engineer on a rainy rooftop looking across a futuristic megacity toward a massive glowing AI tower.",
    summary:
      "A cinematic image-to-video workflow for turning a reference still into a realistic moving shot.",
  },
  {
    id: "text-to-video",
    title: "Text to Video",
    desc: "Create videos from text descriptions",
    icon: "🎬",
    tone: "pink",
    kind: "text-to-video",
    provider: "fal",
    duration: "8s",
    aspectRatio: "16:9",
    style: "Sci-Fi Drama",
    prompt:
      "Create an 8-second cinematic establishing shot for a premium sci-fi drama: rain-soaked megacity, lone engineer, glowing AI tower, slow push-in.",
    summary:
      "A director-style text-to-video workflow for cinematic shots, ads, scenes, and launch films.",
  },
  {
    id: "voice-captions",
    title: "Voice & Captions",
    desc: "Generate voiceovers & captions",
    icon: "🎙️",
    tone: "cyan",
    kind: "voice",
    provider: "elevenlabs",
    duration: "N/A",
    aspectRatio: "N/A",
    style: "Narration",
    prompt:
      "This is a test voice generation from STREAMS AI, delivered with calm cinematic confidence.",
    summary:
      "A voice workflow for narration, captions, dubbing, creator voiceovers, and audio-first outputs.",
  },
  {
    id: "snap-pick-click",
    title: "Snap Pic Click",
    desc: "Pick, animate, edit action",
    icon: "📸",
    tone: "orange",
    kind: "snap-pick-click",
    provider: "fal",
    duration: "6s",
    aspectRatio: "9:16",
    style: "Social Action",
    prompt:
      "Animate the uploaded snap into a polished short-form cinematic action clip.",
    summary:
      "A fast photo-to-action workflow for turning a selected image into edited motion or social content.",
  },
  {
    id: "motion-graphics",
    title: "Motion Graphics",
    desc: "Create stunning motion graphics",
    icon: "🔷",
    tone: "blue",
    kind: "motion",
    provider: "fal",
    duration: "6s",
    aspectRatio: "16:9",
    style: "Motion Design",
    prompt:
      "Create premium motion graphics with neon blue panels, elegant UI movement, and cinematic depth.",
    summary:
      "A motion graphics workflow for animated interface pieces, title cards, product motion, and brand visuals.",
  },
  {
    id: "ai-writers",
    title: "AI Writers",
    desc: "Scripts, ideas, blogs, X posts",
    icon: "📄",
    tone: "violet",
    kind: "launch",
    provider: "openai",
    duration: "N/A",
    aspectRatio: "N/A",
    style: "Script Pack",
    prompt:
      "Create a premium launch script, hooks, captions, and campaign copy for an AI video product.",
    summary:
      "A writing workflow for scripts, hooks, captions, posts, launch angles, and campaign structure.",
  },
  {
    id: "idea-launch",
    title: "Idea to Launch",
    desc: "Turn ideas into full campaigns",
    icon: "🚀",
    tone: "gold",
    kind: "launch",
    provider: "openai",
    duration: "N/A",
    aspectRatio: "16:9",
    style: "Launch Campaign",
    prompt:
      "Turn a rough AI product idea into a premium launch campaign with visuals, hooks, and first ads.",
    summary:
      "A full launch workflow for taking an idea into brand, content, creative assets, and campaign outputs.",
  },
];

const keyframes = [
  "https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=360&q=85",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=360&q=85",
  "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=360&q=85",
  "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=360&q=85",
  "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=360&q=85",
  "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=360&q=85",
  "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=360&q=85",
  "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=360&q=85",
];

const previewImage =
  "https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=1600&q=90";

const advancedTabs = [
  ["Prompt", "✣"],
  ["Camera", "▣"],
  ["Lighting", "☼"],
  ["Motion", "⌘"],
  ["Style", "✥"],
  ["Output", "▧"],
];

function useStageFit() {
  const [fit, setFit] = useState({ scale: 1, left: 0, top: 0 });

  useEffect(() => {
    function update() {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const scale = width / BOARD_WIDTH;
      setFit({
        scale,
        left: 0,
        top: Math.max(0, (height - BOARD_HEIGHT * scale) / 2),
      });
    }

    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return fit;
}

export default function OpusLockedFrame() {
  const fit = useStageFit();
  const [activeStudioId, setActiveStudioId] = useState("image-to-video");
  const activeStudio =
    studios.find((studio) => studio.id === activeStudioId) || studios[1];

  const [prompt, setPrompt] = useState(activeStudio.prompt);
  const [provider, setProvider] = useState(activeStudio.provider);
  const [duration, setDuration] = useState(activeStudio.duration);
  const [aspectRatio, setAspectRatio] = useState(activeStudio.aspectRatio);
  const [style, setStyle] = useState(activeStudio.style);
  const [activeTab, setActiveTab] = useState("Prompt");
  const [status, setStatus] = useState("Preview Ready");
  const [intakeUrl, setIntakeUrl] = useState("");
  const [intakeStatus, setIntakeStatus] = useState("Ready for production references");
  const [intakeResult, setIntakeResult] = useState(null);
  const [uploadedAssets, setUploadedAssets] = useState([]);
  const [isIntaking, setIsIntaking] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    setPrompt(activeStudio.prompt);
    setProvider(activeStudio.provider);
    setDuration(activeStudio.duration);
    setAspectRatio(activeStudio.aspectRatio);
    setStyle(activeStudio.style);
    setStatus("Builder Reset");
  }, [activeStudio]);

  const boardStyle = useMemo(
    () => ({
      width: BOARD_WIDTH,
      height: BOARD_HEIGHT,
      transform: `translate3d(${fit.left}px, ${fit.top}px, 0) scale(${fit.scale})`,
    }),
    [fit]
  );

  function getReadableIntakeResult(data) {
    if (!data) return "No analysis yet.";
    if (typeof data === "string") return data;

    const candidates = [
      data.summary,
      data.analysis?.summary,
      data.result?.summary,
      data.result?.analysis?.summary,
      data.result?.transcript,
      data.result?.title,
      data.result?.description,
      data.data?.summary,
      data.title,
      data.transcript,
      data.text,
      data.description,
      data.error,
      data.result?.error,
    ].filter(Boolean);

    if (candidates.length > 0) {
      return String(candidates[0]).slice(0, 420);
    }

    try {
      return JSON.stringify(data).slice(0, 420);
    } catch {
      return "Analysis returned, but could not be displayed.";
    }
  }

  function applyIntakeToBuilder() {
    const text = getReadableIntakeResult(intakeResult);
    if (!text || text === "No analysis yet.") return;

    setPrompt((current) =>
      `${current}\n\nReference analysis:\n${text}`.slice(0, 2000),
    );
    setStatus("Reference Applied");
  }

  async function analyzeUrl() {
    const url = intakeUrl.trim();

    if (!url) {
      setIntakeStatus("Paste a YouTube, website, or reference URL first.");
      return;
    }

    setIsIntaking(true);
    setIntakeStatus("Analyzing link through intake wrapper...");
    setIntakeResult(null);

    try {
      const response = await fetch("/api/admingeneration/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "auto", url, source: "admingeneration" }),
      });

      const data = await response.json().catch(() => null);
      setIntakeResult(data);
      setIntakeStatus(response.ok ? "Link analyzed" : "Analyzer returned a blocked/error state");
    } catch (error) {
      setIntakeResult({ error: error instanceof Error ? error.message : "Link analysis failed" });
      setIntakeStatus("Link analysis failed");
    } finally {
      setIsIntaking(false);
    }
  }

  async function uploadFiles(files) {
    const selectedFiles = Array.from(files || []);

    if (selectedFiles.length === 0) return;

    setIsIntaking(true);
    setIntakeStatus(`Uploading ${selectedFiles.length} asset${selectedFiles.length === 1 ? "" : "s"}...`);

    const uploaded = [];

    for (const file of selectedFiles) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", file.type?.startsWith("video/") ? "video-ingest" : "upload");
      formData.append("source", "admingeneration");

      try {
        const response = await fetch("/api/admingeneration/intake", {
          method: "POST",
          body: formData,
        });

        const data = await response.json().catch(() => ({}));
        uploaded.push({
          name: file.name,
          type: file.type || "unknown",
          size: file.size,
          ok: response.ok,
          data,
        });
      } catch (error) {
        uploaded.push({
          name: file.name,
          type: file.type || "unknown",
          size: file.size,
          ok: false,
          data: { error: error instanceof Error ? error.message : "Upload failed" },
        });
      }
    }

    setUploadedAssets((current) => [...uploaded, ...current].slice(0, 8));
    setIntakeResult(uploaded[0]?.data || null);
    setIntakeStatus("Upload complete. Select an asset chip to analyze as reference.");
    setIsIntaking(false);
  }

  async function analyzeUploadedReference(asset) {
    if (!asset) return;

    setIsIntaking(true);
    setIntakeStatus("Analyzing uploaded reference...");

    const possibleUrl =
      asset.data?.result?.url ||
      asset.data?.result?.asset?.url ||
      asset.data?.result?.publicUrl ||
      asset.data?.result?.fileUrl ||
      asset.data?.url ||
      asset.data?.assetUrl ||
      asset.data?.path ||
      "";

    try {
      const response = await fetch("/api/admingeneration/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "reference",
          assetUrl: possibleUrl,
          fileName: asset.name,
          mimeType: asset.type,
          source: "admingeneration",
        }),
      });

      const data = await response.json().catch(() => ({}));
      setIntakeResult(data);
      setIntakeStatus(response.ok ? "Reference analyzed" : "Reference analyzer returned a blocked/error state");
    } catch (error) {
      setIntakeResult({ error: error instanceof Error ? error.message : "Reference analysis failed" });
      setIntakeStatus("Reference analysis failed");
    } finally {
      setIsIntaking(false);
    }
  }

  function handleGenerate() {
    setStatus("Protected API Ready");
  }

  return (
    <main className="opus-fit-shell">
      <div className="opus-board" style={boardStyle}>
        <aside className="opus-left">
          <div className="opus-logo-row">
            <div className="opus-logo-mark" />
            <div>
              <div className="opus-logo-title">Opus</div>
              <div className="opus-logo-sub">by Agent Opus</div>
            </div>
          </div>

          <nav className="opus-nav">
            {[
              ["⌂", "Home", true],
              ["▣", "My Projects"],
              ["▦", "Templates"],
              ["☻", "AI Avatars"],
              ["◇", "Brand Kit"],
              ["▧", "Assets"],
              ["♧", "Team"],
              ["◷", "Analytics"],
              ["⚙", "Integrations"],
              ["⚙", "Settings"],
            ].map(([icon, label, active]) => (
              <button className={`opus-nav-item ${active ? "active" : ""}`} key={label} type="button">
                <span>{icon}</span>
                <strong>{label}</strong>
              </button>
            ))}
          </nav>

          <div className="left-studio-switcher">
            <div className="left-studio-title">Studio Systems</div>
            <div className="studio-tab-row">
              {studios.map((studio) => (
                <button
                  className={`studio-tab-card ${studio.tone} ${studio.id === activeStudioId ? "active" : ""}`}
                  key={studio.id}
                  type="button"
                  onClick={() => setActiveStudioId(studio.id)}
                >
                  <div className="studio-tab-icon">{studio.icon}</div>
                  <strong>{studio.title}</strong>
                  <span>{studio.desc}</span>
                </button>
              ))}
            </div>


            <div className="studio-reset-note">
              ⓘ Each studio tab reloads the builder with settings and tools optimized for that workflow.
            </div>


          </div>

          <div className="opus-plan-card">
            <div className="muted">PLAN</div>
            <div className="plan-top">
              <strong>Pro Plan</strong>
              <button type="button">Upgrade</button>
            </div>
            <div className="muted">Credits</div>
            <div className="credit-value">2,450 / 5,000</div>
            <div className="credit-track">
              <span />
            </div>
            <div className="muted">Reset on Aug 12, 2025</div>
          </div>

          <button className="opus-community" type="button">💬 Join Community</button>
        </aside>

        <section className="opus-main generation-main">
          <header className="opus-top generation-top">
            <div>
              <h1>Good evening, Creator 👋</h1>
              <p>Craft cinematic outputs with precision and control.</p>
            </div>
            <div className="opus-account-row">
              <div className="credit-pill">🟣 Credits: 2,450</div>
              <button className="mini-upgrade" type="button">Upgrade</button>
              <button className="bell" type="button">🔔</button>
              <button className="creator-menu" type="button">C&nbsp;&nbsp; Creator⌄</button>
            </div>
          </header>

          <div className="mode-row generation-modes">
            <button className="mode" type="button">⚡ Smart Mode</button>
            <button className="mode active" type="button">⚡ Advanced Mode</button>
            <button className="mode" type="button">✨ AI Assistant</button>
          </div>

          <section className="production-intake-panel">
            <div
              className={`intake-drop-zone ${isDragging ? "dragging" : ""}`}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                uploadFiles(event.dataTransfer.files);
              }}
            >
              <strong>Production Intake + Analyzer</strong>
              <span>Drop video, image refs, audio, PDFs, scripts, style assets</span>
              <input
                multiple
                type="file"
                accept="video/*,image/*,audio/*,.pdf,.txt,.md,.doc,.docx"
                onChange={(event) => uploadFiles(event.target.files)}
              />
            </div>

            <div className="intake-url-box">
              <label>
                <span>YouTube / Website / Reference URL</span>
                <input
                  value={intakeUrl}
                  onChange={(event) => setIntakeUrl(event.target.value)}
                  placeholder="Paste YouTube, website, product page, script page, or reference URL"
                />
              </label>
              <button disabled={isIntaking} onClick={analyzeUrl} type="button">
                {isIntaking ? "Analyzing..." : "Analyze URL"}
              </button>
            </div>

            <div className="intake-results-box">
              <div className="intake-status">{intakeStatus}</div>
              <p>{getReadableIntakeResult(intakeResult)}</p>
              <div className="asset-chip-row">
                {uploadedAssets.slice(0, 3).map((asset) => (
                  <button key={`${asset.name}-${asset.size}`} onClick={() => analyzeUploadedReference(asset)} type="button">
                    {asset.ok ? "✓" : "!"} {asset.name}
                  </button>
                ))}
              </div>
              <button className="apply-analysis" onClick={applyIntakeToBuilder} type="button">
                Feed Analysis Into Movie Builder
              </button>
            </div>
          </section>

          <section className="builder-strip">
            <label className="builder-field prompt-field">
              <span>Main Prompt</span>
              <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} />
              <b>{prompt.length} / 2000</b>
            </label>

            <label className="builder-field">
              <span>Provider</span>
              <select value={provider} onChange={(event) => setProvider(event.target.value)}>
                <option value="openai">openai</option>
                <option value="fal">fal</option>
                <option value="runway">runway</option>
                <option value="kling">kling</option>
                <option value="veo">veo</option>
                <option value="elevenlabs">elevenlabs</option>
              </select>
            </label>

            <label className="builder-field small">
              <span>Duration</span>
              <select value={duration} onChange={(event) => setDuration(event.target.value)}>
                <option>8s</option>
                <option>6s</option>
                <option>4s</option>
                <option>N/A</option>
              </select>
            </label>

            <label className="builder-field small">
              <span>Aspect Ratio</span>
              <select value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value)}>
                <option>16:9</option>
                <option>9:16</option>
                <option>1:1</option>
                <option>N/A</option>
              </select>
            </label>

            <label className="builder-field">
              <span>Style</span>
              <input value={style} onChange={(event) => setStyle(event.target.value)} />
            </label>

            <button className="primary-generate" onClick={handleGenerate} type="button">
              Generate ✨
            </button>
          </section>

          <section className="preview-layout">
            <div className="preview-column">
              <div className="video-shell">
                <img src={previewImage} alt="Generated preview" />
                <div className="live-status">{status}</div>
                <div className="video-controls">
                  <b>▶</b>
                  <span>0:00 / {duration === "N/A" ? "0:08" : `0:0${duration.replace("s", "")}`}</span>
                  <i />
                  <em>CC</em>
                  <em>1x</em>
                  <em>◔</em>
                  <em>⛶</em>
                </div>
              </div>

              <section className="timeline-card">
                <div className="timeline-head">
                  <strong>Timeline / Keyframes</strong>
                  <span>{duration === "N/A" ? "8s" : duration} • 8 Keyframes</span>
                </div>
                <div className="keyframe-row">
                  {keyframes.map((image, index) => (
                    <div className={`keyframe ${index === 0 ? "active" : ""}`} key={image}>
                      <img src={image} alt="" />
                      <span>{index}s</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="versions-card">
                <div className="section-head compact">
                  <h3>Related Outputs / Previous Versions</h3>
                  <button type="button">View all versions →</button>
                </div>
                <div className="versions-row">
                  {["Version 2 (Current)", "Version 1", "Alt Variation A", "Alt Variation B", "+2 More Versions"].map(
                    (title, index) => (
                      <article className="version-item" key={title}>
                        <img src={keyframes[index % keyframes.length]} alt="" />
                        <strong>{title}</strong>
                        <span>{duration === "N/A" ? "8s" : duration} • {aspectRatio} • {provider}</span>
                      </article>
                    )
                  )}
                </div>
              </section>

              <section className="advanced-dock">
                <button className="advanced-toggle" type="button">⌄ Advanced Controls</button>
                {advancedTabs.map(([tab, icon]) => (
                  <button
                    className={tab === activeTab ? "active" : ""}
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    type="button"
                  >
                    <span>{icon}</span>
                    {tab}
                  </button>
                ))}
              </section>
            </div>

            <aside className="builder-side">
              <section className="summary-card">
                <h3>✨ Generation Summary</h3>
                <p>{activeStudio.summary}</p>
              </section>

              <section className="summary-card">
                <h3>▣ Prompt Snapshot</h3>
                <p>{prompt}</p>
                <button type="button">View Full Prompt</button>
              </section>

              <section className="summary-card two-col">
                <h3>📷 Camera Settings Summary</h3>
                <div><span>Camera Movement</span><b>Slow Push In</b></div>
                <div><span>Shot Type</span><b>Wide Shot</b></div>
                <div><span>Lens</span><b>18mm Wide</b></div>
                <div><span>Angle</span><b>High Angle</b></div>
                <button type="button">View All Settings</button>
              </section>

              <section className="summary-card two-col">
                <h3>ⓘ Generation Details</h3>
                <div><span>Kind</span><b>{activeStudio.kind}</b></div>
                <div><span>Provider</span><b>{provider}</b></div>
                <div><span>Duration</span><b>{duration}</b></div>
                <div><span>Aspect</span><b>{aspectRatio}</b></div>
                <div><span>Status</span><b>{status}</b></div>
                <button type="button">View Technical Details</button>
              </section>

              <section className="summary-card backend-card">
                <h3>☁ System / Backend Status</h3>
                <div className="status-good">Protected API Connected <span>●</span></div>
                <div className="status-line"><strong>OpenAI</strong><p>Runtime proven</p></div>
                <div className="status-line"><strong>fal.ai</strong><p>Runtime + jobs persistence proven</p></div>
                <div className="status-line"><strong>Runway / Kling / Veo</strong><p>Endpoint contracts required</p></div>
              </section>
            </aside>
          </section>
        </section>
      </div>
    </main>
  );
}
