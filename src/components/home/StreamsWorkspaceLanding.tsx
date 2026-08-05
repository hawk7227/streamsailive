"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./streams-workspace-landing.module.css";
import brainStyles from "./streams-workspace-brain.module.css";

const icons = {
  ask: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18.5 3.5 21v-5A8 8 0 1 1 7 18.5Z"/><path d="M8 10h.01M12 10h.01M16 10h.01"/></svg>
  ),
  seek: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
  ),
  knock: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 8 4.5v11L12 22l-8-4.5v-11L12 2Z"/><path d="m4 6.5 8 4.5 8-4.5M12 11v11"/></svg>
  ),
  folder: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h6l2 2h10v11H3Z"/></svg>
  ),
  brain: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 4a3 3 0 0 0-5 2.2A3.5 3.5 0 0 0 5 13a3.5 3.5 0 0 0 4.5 4.7V4ZM14.5 4a3 3 0 0 1 5 2.2A3.5 3.5 0 0 1 19 13a3.5 3.5 0 0 1-4.5 4.7V4Z"/></svg>
  ),
  sparkle: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3Z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/></svg>
  ),
  bolt: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m13 2-8 12h6l-1 8 9-13h-6V2Z"/></svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 6v5c0 5.2-3.2 8.7-8 10-4.8-1.3-8-4.8-8-10V6l8-3Z"/><path d="m9 12 2 2 4-4"/></svg>
  ),
};

const pillars = [
  { key: "ask", title: "Ask", text: "Get intelligent answers and brainstorm ideas with A.S.K. AI." },
  { key: "seek", title: "Seek", text: "Find insights, research, and the right information instantly." },
  { key: "knock", title: "A.S.K. Knock", text: "Execute ideas with powerful building and automation tools." },
] as const;

const outcomes = [
  { key: "folder", title: "All your work, in one place", text: "Projects, files, tasks, and more—organized around the work that matters." },
  { key: "brain", title: "AI that understands your context", text: "A.S.K. AI remembers and stays in sync across your workspace." },
  { key: "sparkle", title: "Create without limits", text: "Create content, visuals, videos, voices, and more from one place." },
  { key: "bolt", title: "Build and automate faster", text: "A.S.K. Knock helps you build, deploy, and ship with confidence." },
  { key: "shield", title: "Secure and private by design", text: "Your workspace is protected with account and workspace isolation." },
] as const;

function InteractiveBrainOrb() {
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    let stopTimer: ReturnType<typeof setTimeout> | undefined;
    const startSpeaking = () => {
      setSpeaking(true);
      if (stopTimer) clearTimeout(stopTimer);
      stopTimer = setTimeout(() => setSpeaking(false), 3200);
    };
    const stopSpeaking = () => {
      if (stopTimer) clearTimeout(stopTimer);
      setSpeaking(false);
    };

    const simulation = setInterval(startSpeaking, 8500);
    const first = setTimeout(startSpeaking, 1800);
    window.addEventListener("streams-ai:speaking", startSpeaking);
    window.addEventListener("streams-ai:idle", stopSpeaking);

    return () => {
      clearInterval(simulation);
      clearTimeout(first);
      if (stopTimer) clearTimeout(stopTimer);
      window.removeEventListener("streams-ai:speaking", startSpeaking);
      window.removeEventListener("streams-ai:idle", stopSpeaking);
    };
  }, []);

  return (
    <button
      type="button"
      className={`${styles.orbStage} ${brainStyles.orbStage} ${speaking ? brainStyles.isSpeaking : brainStyles.isIdle}`}
      onClick={() => setSpeaking((current) => !current)}
      aria-label={speaking ? "A.S.K. AI is speaking. Activate to pause the simulation." : "A.S.K. AI is idle. Activate to preview speaking mode."}
      aria-pressed={speaking}
    >
      <span className={`${styles.orbitOne} ${brainStyles.orbitOne}`}/><span className={`${styles.orbitTwo} ${brainStyles.orbitTwo}`}/><span className={`${styles.orbitThree} ${brainStyles.orbitThree}`}/>
      <span className={`${styles.orb} ${brainStyles.orb}`}>
        <span className={brainStyles.brainGlow}/>
        <svg className={brainStyles.brainGraphic} viewBox="0 0 320 260" aria-hidden="true">
          <defs>
            <linearGradient id="brain-violet" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#d8c8ff"/>
              <stop offset=".48" stopColor="#9f67ff"/>
              <stop offset="1" stopColor="#6d4cff"/>
            </linearGradient>
            <filter id="brain-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="5" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          <path className={brainStyles.brainBody} d="M104 56c-26 0-45 17-44 41-17 9-22 31-13 48-16 16-8 42 15 50 1 23 21 38 43 34 12 12 33 13 47 1 12 12 31 11 41 0 18 5 38-8 41-27 19-7 29-28 21-45 15-16 9-40-9-49 2-24-16-43-39-45-12-20-38-27-57-14-13-10-33-9-46 6Z"/>
          <g className={brainStyles.brainFolds}>
            <path d="M80 88c21-19 47-15 52 8 3 14-10 24-28 21-19-3-28 11-18 24"/>
            <path d="M142 70c14 15 8 34-7 43-14 9-18 25-8 39"/>
            <path d="M174 68c14 12 19 31 8 44-10 13-29 14-33 34"/>
            <path d="M207 79c17 5 27 20 20 36-7 17-29 19-34 38"/>
            <path d="M244 104c-16 10-16 29-3 38 15 11 16 28 4 39"/>
            <path d="M61 148c18-7 35 1 37 16 2 14-10 24-27 23"/>
            <path d="M112 155c15-8 34-2 38 13 4 14-8 26-24 24"/>
            <path d="M164 153c16-8 35 0 39 15 4 14-8 26-24 24"/>
            <path d="M213 149c17-4 32 5 33 20 2 13-8 24-24 26"/>
            <path d="M88 199c13-9 29-6 37 5 7 10 3 20-6 28"/>
            <path d="M143 198c14-9 31-4 36 9 4 11-1 21-11 29"/>
            <path d="M194 197c16-7 32 0 34 15 2 9-5 18-13 23"/>
          </g>
        </svg>
        <span className={brainStyles.voiceBars} aria-hidden="true">
          <i/><i/><i/><i/><i/><i/><i/>
        </span>
        <span className={brainStyles.energyBeam}/>
      </span>
      <span className={brainStyles.orbStatus}>{speaking ? "A.S.K. IS SPEAKING" : "A.S.K. IS LISTENING"}</span>
    </button>
  );
}

export default function StreamsWorkspaceLanding() {
  return (
    <main className={styles.page}>
      <section className={styles.hero} aria-labelledby="streams-workspace-title">
        <div className={styles.heroCopy}>
          <span className={styles.kicker}>STREAMS WORKSPACE</span>
          <h1 id="streams-workspace-title">
            Your intelligent workspace for <span>thinking, creating,</span> and <strong>building.</strong>
          </h1>
          <h2>Streams Workspace, hosted by <em>A.S.K. AI.</em></h2>
          <p>Ask questions, seek answers, organize work, create content, and turn ideas into completed projects from one connected workspace.</p>
          <div className={styles.actions}>
            <Link href="/signup" className={styles.primaryButton}>Get Started for Free</Link>
            <a href="#how-it-works" className={styles.secondaryButton}>See How It Works <span aria-hidden="true">▶</span></a>
          </div>
        </div>

        <InteractiveBrainOrb />
      </section>

      <section className={styles.pillars} aria-label="A.S.K. AI principles">
        {pillars.map((item) => <article key={item.key}>
          <div className={`${styles.icon} ${styles[item.key]}`}>{icons[item.key]}</div>
          <div><h3>{item.title}</h3><p>{item.text}</p></div>
        </article>)}
      </section>

      <section id="how-it-works" className={styles.connected}>
        <h2>Everything you need, in <span>one connected workspace.</span></h2>
        <div className={styles.outcomes}>
          {outcomes.map((item) => <article key={item.key}>
            <div className={styles.outcomeIcon}>{icons[item.key]}</div>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </article>)}
        </div>
      </section>

      <footer className={styles.footerStrip}>
        <div><span className={styles.footerOrb}/><p><strong>Always evolving</strong><small>New features. New possibilities.</small></p></div>
        <div><span className={styles.footerCheck}>✓</span><p><strong>Built for results</strong><small>From ideas to completed work.</small></p></div>
      </footer>
    </main>
  );
}
