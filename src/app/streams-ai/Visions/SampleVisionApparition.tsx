"use client";

import { useEffect, useRef, useState } from "react";

const VIDEO_SRC = "/d4b2ed55-e055-4b75-8fcf-d0acf8f60c77.mp4";

export default function SampleVisionApparition() {
  const [playing, setPlaying] = useState(false);
  const [run, setRun] = useState(0);
  const timerRef = useRef<number | null>(null);

  function play() {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setRun((value) => value + 1);
    setPlaying(true);
    timerRef.current = window.setTimeout(() => setPlaying(false), 10800);
  }

  useEffect(() => {
    const start = window.setTimeout(play, 1100);
    return () => {
      window.clearTimeout(start);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <>
      <button type="button" className="sampleReplay" onClick={play} aria-label="Play sample vision">
        Play sample vision
      </button>

      {playing ? (
        <div key={run} className="sampleVeil" aria-label="Sample dream vision">
          <div className="sampleMist" aria-hidden="true" />
          <div className="sampleWindow">
            <video src={VIDEO_SRC} autoPlay muted loop playsInline preload="metadata" />
            <div className="sampleShade" aria-hidden="true" />
            <p>The path remembers.</p>
          </div>
        </div>
      ) : null}

      <style jsx>{`
        .sampleReplay{position:fixed;z-index:30;right:18px;top:76px;min-height:36px;border:1px solid rgba(148,163,184,.22);border-radius:999px;padding:7px 13px;background:rgba(8,12,28,.72);color:#cfd7f5;font-size:11px;font-weight:700;backdrop-filter:blur(14px);cursor:pointer}
        .sampleReplay:hover{color:#fff;border-color:rgba(124,104,255,.62)}
        .sampleVeil{position:fixed;z-index:24;inset:64px 0 88px;display:grid;place-items:center;pointer-events:none;overflow:hidden;background:radial-gradient(circle at 50% 48%,rgba(44,36,98,.12),transparent 38%);animation:veilLife 10.8s ease-in-out both}
        .sampleMist{position:absolute;width:min(72vw,760px);height:min(52vw,520px);border-radius:50%;background:radial-gradient(circle,rgba(112,91,255,.2),rgba(38,184,255,.07) 42%,transparent 72%);filter:blur(42px);animation:mistBreath 10.8s ease-in-out both}
        .sampleWindow{position:relative;width:min(68vw,520px);aspect-ratio:16/9;overflow:hidden;border-radius:28px;isolation:isolate;box-shadow:0 28px 100px rgba(0,0,0,.72);animation:apparition 10.8s cubic-bezier(.18,.72,.2,1) both}
        .sampleWindow video{position:absolute;inset:-5%;width:110%;height:110%;object-fit:cover;opacity:.34;filter:blur(10px) saturate(.72) brightness(.62);transform:scale(1.08);animation:videoDream 10.8s ease-in-out both}
        .sampleShade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(3,5,14,.34),rgba(3,5,14,.16) 44%,rgba(2,3,9,.76)),radial-gradient(circle at center,transparent 18%,rgba(1,2,8,.68) 78%)}
        .sampleWindow p{position:absolute;z-index:2;left:0;right:0;bottom:19%;margin:0;text-align:center;color:rgba(239,242,255,.94);font:600 clamp(1.15rem,3vw,2rem)/1.1 Georgia,serif;letter-spacing:.04em;text-shadow:0 4px 26px #000;opacity:0;filter:blur(8px);animation:wisdom 10.8s ease-in-out both}
        @keyframes veilLife{0%,100%{opacity:0}12%{opacity:.24}38%,68%{opacity:1}88%{opacity:.2}}
        @keyframes mistBreath{0%{opacity:0;transform:scale(.72)}42%{opacity:.72;transform:scale(1)}72%{opacity:.5;transform:scale(1.06)}100%{opacity:0;transform:scale(1.14)}}
        @keyframes apparition{0%{opacity:0;filter:blur(28px);transform:translateY(18px) scale(.88)}35%{opacity:.32;filter:blur(14px);transform:translateY(4px) scale(.96)}58%{opacity:.62;filter:blur(5px);transform:translateY(0) scale(1)}76%{opacity:.5;filter:blur(8px)}100%{opacity:0;filter:blur(26px);transform:scale(1.04)}}
        @keyframes videoDream{0%{opacity:.04;filter:blur(24px) saturate(.45) brightness(.4);transform:scale(1.14)}44%{opacity:.28;filter:blur(13px) saturate(.62) brightness(.54)}64%{opacity:.38;filter:blur(8px) saturate(.72) brightness(.62);transform:scale(1.08)}78%{opacity:.28;filter:blur(12px) saturate(.56) brightness(.48)}100%{opacity:0;filter:blur(28px) saturate(.35) brightness(.32);transform:scale(1.16)}}
        @keyframes wisdom{0%,43%{opacity:0;filter:blur(12px);transform:translateY(10px)}57%,72%{opacity:1;filter:blur(0);transform:translateY(0)}88%,100%{opacity:0;filter:blur(10px);transform:translateY(-6px)}}
        @media(max-width:680px){.sampleReplay{top:70px;right:10px}.sampleWindow{width:min(88vw,420px);border-radius:22px}}
        @media(prefers-reduced-motion:reduce){.sampleVeil,.sampleMist,.sampleWindow,.sampleWindow video,.sampleWindow p{animation-duration:1ms!important}.sampleWindow p{opacity:1;filter:none}}
      `}</style>
    </>
  );
}
