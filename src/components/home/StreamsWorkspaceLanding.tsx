"use client";

import Link from "next/link";
import styles from "./streams-workspace-landing.module.css";

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

        <div className={styles.orbStage} aria-hidden="true">
          <div className={styles.orbitOne}/><div className={styles.orbitTwo}/><div className={styles.orbitThree}/>
          <div className={styles.orb}><span/></div>
        </div>
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
