"use client";

import { useEffect, useMemo, useState } from "react";
import "./opus-locked-frame.css";

const BOARD_WIDTH = 1920;
const BOARD_HEIGHT = 780;

const creationTypes = [
  {
    title: "Text to Image",
    desc: "Generate stunning images from text",
    icon: "🖼️",
    tone: "blue",
  },
  {
    title: "Image to Video",
    desc: "Turn images into dynamic videos",
    icon: "🎞️",
    tone: "purple",
  },
  {
    title: "Text to Video",
    desc: "Create videos from text descriptions",
    icon: "🎬",
    tone: "pink",
  },
  {
    title: "Voice & Captions",
    desc: "Generate voiceovers & captions",
    icon: "🎙️",
    tone: "cyan",
  },
  {
    title: "Snap Pic Click",
    desc: "Pick, animate, edit action",
    icon: "📸",
    tone: "orange",
  },
  {
    title: "Motion Graphics",
    desc: "Create stunning motion graphics",
    icon: "🔷",
    tone: "blue",
  },
  {
    title: "AI Writers",
    desc: "Scripts, ideas, blogs, X posts",
    icon: "📄",
    tone: "violet",
  },
  {
    title: "Idea to Launch",
    desc: "Turn ideas into full campaigns",
    icon: "🚀",
    tone: "gold",
  },
  {
    title: "Collect Assets",
    desc: "Find & organize perfect assets",
    icon: "📁",
    tone: "green",
  },
  {
    title: "Create Hook",
    desc: "Generate viral video hooks",
    icon: "⚡",
    tone: "red",
  },
];

const progressItems = [
  {
    title: "Motivation Video",
    meta: "Text to Video • 9:16",
    status: "Rendering...",
    progress: 78,
    image:
      "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=360&q=85",
  },
  {
    title: "Cinematic Scene",
    meta: "Image to Video • 16:9",
    status: "Generating...",
    progress: 45,
    image:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=360&q=85",
  },
  {
    title: "Fitness Promo",
    meta: "Motion Graphics • 9:16",
    status: "Almost done...",
    progress: 90,
    image:
      "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=360&q=85",
  },
  {
    title: "Podcast Clip",
    meta: "Voice & Captions • 1:1",
    status: "Adding captions...",
    progress: 60,
    image:
      "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=360&q=85",
  },
  {
    title: "Product Launch",
    meta: "Idea to Launch • 16:9",
    status: "Analyzing idea...",
    progress: 30,
    image:
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=360&q=85",
  },
];

const projects = [
  {
    title: "Cyberpunk Short Film",
    meta: "Edited 2 hours ago",
    time: "00:45",
    image:
      "https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=520&q=85",
  },
  {
    title: "Product Launch Video",
    meta: "Edited yesterday",
    time: "01:12",
    image:
      "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=520&q=85",
  },
  {
    title: "Travel Vlog Intro",
    meta: "Edited 2 days ago",
    time: "00:59",
    image:
      "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=520&q=85",
  },
  {
    title: "Fitness Motivation",
    meta: "Edited 3 days ago",
    time: "00:30",
    image:
      "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=520&q=85",
  },
  {
    title: "Tech Product Promo",
    meta: "Edited 5 days ago",
    time: "00:15",
    image:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=520&q=85",
  },
  {
    title: "Brand Rebuild 2024",
    meta: "Edited 1 week ago",
    time: "01:05",
    image:
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=520&q=85",
  },
];

const recentProjects = [
  {
    title: "Summer Sale Campaign",
    meta: "Edited 2h ago",
    image:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=140&q=80",
  },
  {
    title: "Product Launch Video",
    meta: "Edited 5h ago",
    image:
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=140&q=80",
  },
  {
    title: "TikTok Ad Series",
    meta: "Edited 1d ago",
    image:
      "https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=140&q=80",
  },
  {
    title: "Brand Rebuild 2024",
    meta: "Edited 2d ago",
    image:
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=140&q=80",
  },
];

const workflow = [
  ["🔎", "Research", "Gather insights"],
  ["📘", "Script", "Write content"],
  ["🎨", "Visualize", "Generate visuals"],
  ["🖊️", "Edit", "Refine content"],
  ["🎙️", "Voices", "Add voice & audio"],
  ["✅", "Brand", "Apply your brand"],
  ["📤", "Export", "Render & publish"],
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

  const boardStyle = useMemo(
    () => ({
      width: BOARD_WIDTH,
      height: BOARD_HEIGHT,
      transform: `translate3d(${fit.left}px, ${fit.top}px, 0) scale(${fit.scale})`,
    }),
    [fit]
  );

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
              <button className={`opus-nav-item ${active ? "active" : ""}`} key={label}>
                <span>{icon}</span>
                <strong>{label}</strong>
              </button>
            ))}
          </nav>

          <div className="opus-plan-card">
            <div className="muted">PLAN</div>
            <div className="plan-top">
              <strong>Pro Plan</strong>
              <button>Upgrade</button>
            </div>
            <div className="muted">Credits</div>
            <div className="credit-value">2,450 / 5,000</div>
            <div className="credit-track">
              <span />
            </div>
            <div className="muted">Reset on Aug 12, 2025</div>
          </div>

          <button className="opus-community">💬 Join Community</button>
        </aside>

        <section className="opus-main">
          <header className="opus-top">
            <div>
              <h1>Good evening, Creator 👋</h1>
              <p>What would you like to create today?</p>
            </div>
            <div className="opus-account-row">
              <div className="credit-pill">🟣 Credits: 2,450</div>
              <button className="mini-upgrade">Upgrade</button>
              <button className="bell">🔔</button>
              <button className="creator-menu">C&nbsp;&nbsp; Creator⌄</button>
            </div>
          </header>

          <div className="mode-row">
            <button className="mode active">⚡ Smart Mode</button>
            <button className="mode">🎬 Advanced Mode</button>
            <button className="mode">✨ AI Assistant</button>
          </div>

          <section className="prompt-card">
            <div>
              <h2>Describe what you want to create...</h2>
              <p>Example: Create a cinematic motivational video about pushing your limits</p>
            </div>
            <div className="prompt-bottom">
              <div className="prompt-actions">
                <button>🎙 Add Media</button>
                <button>📱 9:16</button>
                <button>🎙 Voice</button>
                <button>👤 AI Avatar</button>
                <button>🎨 Style</button>
              </div>
              <div className="generate-area">
                <span>0 / 5000</span>
                <button>Generate ✨</button>
              </div>
            </div>
          </section>

          <section className="section-row">
            <div className="section-head">
              <h3>Choose what you want to create</h3>
              <button>View all studios →</button>
            </div>
            <div className="creation-grid">
              {creationTypes.map((item) => (
                <article className={`creation-card ${item.tone}`} key={item.title}>
                  <div className="creation-icon">{item.icon}</div>
                  <strong>{item.title}</strong>
                  <p>{item.desc}</p>
                  <button>Start →</button>
                </article>
              ))}
            </div>
          </section>

          <section className="section-row">
            <div className="section-head">
              <h3>Your Creations in Progress</h3>
              <button>View all →</button>
            </div>
            <div className="progress-grid">
              {progressItems.map((item) => (
                <article className="progress-card" key={item.title}>
                  <img src={item.image} alt="" />
                  <div className="progress-copy">
                    <strong>{item.title}</strong>
                    <span>{item.meta}</span>
                  </div>
                  <div className="progress-status">
                    <span>{item.status}</span>
                    <b>{item.progress}%</b>
                  </div>
                  <div className="progress-track">
                    <i style={{ width: `${item.progress}%` }} />
                  </div>
                </article>
              ))}
              <article className="new-project-card">
                <div>＋</div>
                <strong>New Project</strong>
                <span>Start Something Amazing</span>
              </article>
            </div>
          </section>

          <section className="section-row">
            <div className="section-head">
              <h3>My Projects</h3>
              <button>View all projects →</button>
            </div>
            <div className="project-grid">
              {projects.map((item) => (
                <article className="project-card" key={item.title}>
                  <div className="project-image">
                    <img src={item.image} alt="" />
                    <span>{item.time}</span>
                  </div>
                  <strong>{item.title}</strong>
                  <p>{item.meta}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="workflow-strip">
            <div className="workflow-title">From Ideas to Impact – Our AI Workflow</div>
            <div className="workflow-items">
              {workflow.map(([icon, title, desc]) => (
                <div className="workflow-item" key={title}>
                  <span>{icon}</span>
                  <div>
                    <strong>{title}</strong>
                    <p>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </section>

        <aside className="opus-right">
          <section className="right-panel quick">
            <h3>Quick Actions</h3>
            {[
              ["＋", "New Project", "Start from scratch"],
              ["▦", "Use a Template", "Browse templates"],
              ["✣", "AI Assistant", "Get help & ideas"],
              ["⇧", "Upload Assets", "Images, videos, audio"],
              ["🎙", "Record Voice", "Voiceover & dubbing"],
            ].map(([icon, title, desc]) => (
              <button className="quick-action" key={title}>
                <span>{icon}</span>
                <div>
                  <strong>{title}</strong>
                  <p>{desc}</p>
                </div>
              </button>
            ))}
          </section>

          <section className="right-panel status-panel">
            <h3>System Status</h3>
            <div className="status-good">All Systems Operational <span>●</span></div>
            <div className="status-line">
              <strong>Render Queue</strong>
              <p>2 Rendering • 4 Queued</p>
            </div>
            <div className="status-line">
              <strong>Storage</strong>
              <p>2.4 TB / 8 TB</p>
              <div className="thin-track"><i /></div>
            </div>
            <div className="usage-row">
              <div>
                <strong>Today's Usage</strong>
                <p>Good usage</p>
              </div>
              <b>78%</b>
            </div>
          </section>

          <section className="right-panel recent-panel">
            <div className="recent-top">
              <h3>Recent Projects</h3>
              <button>View all</button>
            </div>
            {recentProjects.map((item) => (
              <article className="recent-item" key={item.title}>
                <img src={item.image} alt="" />
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.meta}</p>
                </div>
              </article>
            ))}
          </section>

          <section className="help-card">
            <div>💬</div>
            <strong>Need help?</strong>
            <span>Ask AI Assistant</span>
          </section>
        </aside>
      </div>
    </main>
  );
}
