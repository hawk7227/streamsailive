"use client";

import { useEffect, useRef, useState } from "react";

const VIDEO_SRC = "/d4b2ed55-e055-4b75-8fcf-d0acf8f60c77.mp4";

export default function SampleVisionApparition() {
  const [playing, setPlaying] = useState(true);
  const [run, setRun] = useState(1);
  const [videoError, setVideoError] = useState(false);
  const timerRef = useRef<number | null>(null);

  function play() {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setVideoError(false);
    setRun((value) => value + 1);
    setPlaying(true);
    timerRef.current = window.setTimeout(() => setPlaying(false), 12800);
  }

  useEffect(() => {
    timerRef.current = window.setTimeout(() => setPlaying(false), 12800);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <aside className="sampleVisionHost" aria-label="Sample vision player">
      <button type="button" className="sampleReplay" onClick={play}>
        {playing ? "Vision playing" : "Play sample vision"}
      </button>

      {playing ? (
        <div key={run} className="sampleVeil" aria-label="Sample dream vision">
          <div className="sampleMist" aria-hidden="true" />
          <div className="sampleWindow">
            <video
              src={VIDEO_SRC}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              onError={() => setVideoError(true)}
            />
            <div className="sampleShade" aria-hidden="true" />
            <p>{videoError ? "The vision waits." : "The path remembers."}</p>
          </div>
        </div>
      ) : (
        <button type="button" className="samplePortal" onClick={play} aria-label="Replay sample vision">
          <span>✦</span>
          <strong>Replay the vision</strong>
          <small>A brief glimpse, never fully revealed</small>
        </button>
      )}

      <style jsx>{`
        .sampleVisionHost{position:fixed;z-index:80;inset:64px 0 88px;pointer-events:none}
        .sampleReplay{position:absolute;z-index:84;right:18px;top:14px;min-height:38px;border:1px solid rgba(148,163,184,.3);border-radius:999px;padding:8px 14px;background:rgba(8,12,28,.88);color:#eef2ff;font-size:11px;font-weight:800;backdrop-filter:blur(14px);cursor:pointer;pointer-events:auto;box-shadow:0 12px 40px rgba(0,0,0,.35)}
        .sampleReplay:hover{border-color:rgba(124,104,255,.75)}
        .sampleVeil{position:absolute;inset:0;display:grid;place-items:center;overflow:hidden;background:radial-gradient(circle at 50% 48%,rgba(44,36,98,.16),transparent 40%);animation:veilLife 12.8s ease-in-out both}
        .sampleMist{position:absolute;width:min(72vw,760px);height:min(52vw,520px);border-radius:50%;background:radial-gradient(circle,rgba(112,91,255,.24),rgba(38,184,255,.09) 42%,transparent 72%);filter:blur(42px);animation:mistBreath 12.8s ease-in-out both}
        .sampleWindow{position:relative;width:min(58vw,500px);aspect-ratio:16/9;overflow:hidden;border-radius:28px;isolation:isolate;box-shadow:0 28px 100px rgba(0,0,0,.78);animation:apparition 12.8s cubic-bezier(.18,.72,.2,1) both}
        .sampleWindow video{position:absolute;inset:-5%;width:110%;height:110%;object-fit:cover;opacity:.34;filter:blur(10px) saturate(.72) brightness(.62);transform:scale(1.08);animation:videoDream 12.8s ease-in-out both}
        .sampleShade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(3,5,14,.38),rgba(3,5,14,.2) 44%,rgba(2,3,9,.8)),radial-gradient(circle at center,transparent 16%,rgba(1,2,8,.72) 80%)}
        .sampleWindow p{position:absolute;z-index:2;left:0;right:0;bottom:18%;margin:0;text-align:center;color:rgba(239,242,255,.96);font:600 clamp(1.2rem,3vw,2rem)/1.1 Georgia,serif;letter-spacing:.05em;text-shadow:0 4px 26px #000;opacity:0;filter:blur(8px);animation:wisdom 12.8s ease-in-out both}
        .samplePortal{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(86vw,360px);display:grid;place-items:center;gap:8px;padding:24px;border:1px solid rgba(124,104,255,.32);border-radius:24px;background:rgba(8,12,28,.76);color:#eef2ff;backdrop-filter:blur(18px);cursor:pointer;pointer-events:auto;box-shadow:0 24px 80px rgba(0,0,0,.55)}
        .samplePortal span{font-size:28px;color:#8b7cff}.samplePortal strong{font-size:15px}.samplePortal small{color:#9aa6c8;font-size:11px}
        @keyframes veilLife{0%,100%{opacity:0}10%{opacity:.3}34%,72%{opacity:1}90%{opacity:.2}}
        @keyframes mistBreath{0%{opacity:0;transform:scale(.72)}42%{opacity:.75;transform:scale(1)}72%{opacity:.52;transform:scale(1.06)}100%{opacity:0;transform:scale(1.14)}}
        @keyframes apparition{0%{opacity:0;filter:blur(30px);transform:translateY(18px) scale(.88)}34%{opacity:.34;filter:blur(15px);transform:translateY(4px) scale(.96)}58%{opacity:.64;filter:blur(5px);transform:translateY(0) scale(1)}78%{opacity:.5;filter:blur(8px)}100%{opacity:0;filter:blur(28px);transform:scale(1.04)}}
        @keyframes videoDream{0%{opacity:.04;filter:blur(24px) saturate(.45) brightness(.4);transform:scale(1.14)}44%{opacity:.28;filter:blur(13px) saturate(.62) brightness(.54)}64%{opacity:.38;filter:blur(8px) saturate(.72) brightness(.62);transform:scale(1.08)}80%{opacity:.28;filter:blur(12px) saturate(.56) brightness(.48)}100%{opacity:0;filter:blur(28px) saturate(.35) brightness(.32);transform:scale(1.16)}}
        @keyframes wisdom{0%,42%{opacity:0;filter:blur(12px);transform:translateY(10px)}56%,74%{opacity:1;filter:blur(0);transform:translateY(0)}90%,100%{opacity:0;filter:blur(10px);transform:translateY(-6px)}}
        @media(max-width:680px){.sampleReplay{right:10px;top:10px}.sampleWindow{width:min(88vw,420px);border-radius:22px}.sampleVisionHost{inset:64px 0 82px}}
        @media(prefers-reduced-motion:reduce){.sampleVeil,.sampleMist,.sampleWindow,.sampleWindow video,.sampleWindow p{animation-duration:1ms!important}.sampleWindow p{opacity:1;filter:none}}
      `}</style>
    </aside>
  );
}
