"use client";

export default function BuilderCenterChat() {
  return (
    <section className="placeholderSite" aria-label="Placeholder website landing page">
      <header><b>STREAMS AI</b><button type="button">Build</button></header>
      <main>
        <div className="orb" />
        <h1>Ask, build, create, launch.</h1>
        <p>Placeholder website surface for the builder preview.</p>
        <div className="bar"><span>Ask anything</span><button type="button">Thinking...</button><button type="button">Go</button></div>
      </main>
      <footer><span>Portfolio</span><span>Create</span><span>Launch</span><span>Profile</span></footer>
      <style jsx>{`
        .placeholderSite{width:min(100%,430px);max-width:430px;min-width:320px;height:min(932px,calc(100dvh - 24px));min-height:640px;display:grid;grid-template-rows:auto minmax(0,1fr) auto;overflow:hidden;border:1px solid rgba(148,163,184,.16);border-radius:14px;background:radial-gradient(circle at 52% 18%,rgba(56,189,248,.16),transparent 28%),linear-gradient(180deg,#06101f,#020617);color:#fff;box-sizing:border-box;}
        header{height:42px;display:flex;align-items:center;justify-content:space-between;padding:0 18px;border-bottom:1px solid rgba(148,163,184,.1);}header b{font-size:12px;letter-spacing:.28em;}header button{border:1px solid rgba(255,255,255,.14);border-radius:8px;background:rgba(255,255,255,.08);color:#fff;padding:6px 10px;font-size:11px;}
        main{min-height:0;display:grid;place-items:center;text-align:center;padding:18px;}.orb{width:68px;height:68px;border-radius:20px;background:radial-gradient(circle,#22d3ee 0,#7c3aed 45%,#db2777 100%);box-shadow:0 0 54px rgba(34,211,238,.45);margin-bottom:24px;}h1{margin:0;font-size:24px;line-height:1.05;font-weight:500;letter-spacing:-.03em;}p{margin:14px 0 20px;color:#94a3b8;font-size:12px;}.bar{width:min(330px,100%);height:42px;display:grid;grid-template-columns:minmax(0,1fr) auto 38px;gap:6px;align-items:center;border:1px solid rgba(124,58,237,.7);border-radius:999px;background:rgba(2,6,23,.74);padding:4px;box-shadow:0 0 24px rgba(124,58,237,.38);}.bar span{text-align:left;color:#cbd5e1;font-size:11px;padding-left:10px;}.bar button{height:30px;border:0;border-radius:999px;background:#1e1b4b;color:#fff;font-size:10px;padding:0 12px;}.bar button:last-child{padding:0;background:#7c3aed;}
        footer{height:48px;display:grid;grid-template-columns:repeat(4,1fr);align-items:center;border-top:1px solid rgba(148,163,184,.12);background:rgba(2,6,23,.65);}footer span{color:#cbd5e1;font-size:10px;text-align:center;}
      `}</style>
    </section>
  );
}
