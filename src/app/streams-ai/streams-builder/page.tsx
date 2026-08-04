const SAMPLE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sample Landing Page</title>
    <style>
        body, h1, h2, p, a, button {
            margin: 0;
            padding: 0;
            font-family: Arial, sans-serif;
        }
        body { line-height: 1.6; }
        header, main, footer {
            padding: 20px;
            max-width: 1200px;
            margin: auto;
        }
        header {
            background-color: #4CAF50;
            color: white;
            text-align: center;
        }
        nav a {
            color: white;
            margin: 0 10px;
            text-decoration: none;
        }
        nav a:focus { outline: 2px solid yellow; }
        .hero {
            background-color: #f4f4f4;
            padding: 40px;
            text-align: center;
        }
        .hero h1 { margin-bottom: 10px; }
        .content {
            display: flex;
            flex-wrap: wrap;
            justify-content: space-around;
            padding: 20px 0;
        }
        .card {
            background-color: #fff;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            margin: 10px;
            padding: 20px;
            width: calc(33% - 40px);
            transition: transform 0.3s;
        }
        .card:hover { transform: translateY(-10px); }
        .card h2 { margin-bottom: 10px; }
        .card p { color: #333; }
        .card button {
            background-color: #4CAF50;
            color: white;
            border: none;
            padding: 10px 15px;
            margin-top: 10px;
            cursor: pointer;
        }
        .card button:focus { outline: 2px solid yellow; }
        footer {
            background-color: #333;
            color: white;
            text-align: center;
            padding: 10px 0;
        }
        @media(max-width: 768px) { .card { width: calc(48% - 40px); } }
        @media(max-width: 480px) { .card { width: 100%; } }
    </style>
</head>
<body>
    <header>
        <h1>Welcome to Our Landing Page</h1>
        <nav aria-label="Main Navigation">
            <a href="#home">Home</a>
            <a href="#services">Services</a>
            <a href="#contact">Contact</a>
        </nav>
    </header>
    <main>
        <section class="hero" id="home">
            <h1>Your Journey Begins Here</h1>
            <p>Discover endless possibilities with us.</p>
        </section>
        <section class="content" id="services">
            <article class="card">
                <h2>Service One</h2>
                <p>Experience the best of our first service offering.</p>
                <button>Learn More</button>
            </article>
            <article class="card">
                <h2>Service Two</h2>
                <p>Our second service is tailored to your needs.</p>
                <button>Learn More</button>
            </article>
            <article class="card">
                <h2>Service Three</h2>
                <p>Explore the features of our third service.</p>
                <button>Learn More</button>
            </article>
        </section>
    </main>
    <footer>
        <p>&copy; 2023 Sample Landing Page. All rights reserved.</p>
    </footer>
</body>
</html>`;

const LOGS = [
  "Frontend visual placeholder initialized.",
  "Sample landing page source loaded into the editor.",
  "Preview mounted without a repository or branch.",
  "HTML and embedded CSS validated for visual display.",
  "Code Editor, Logs, DevTools, and Frontend UI connected.",
  "Preview ready.",
];

export const dynamic = "force-dynamic";

export default function StreamsAIStreamsBuilderPage() {
  return (
    <main className="demoBuilderShell">
      <section className="demoChatPanel">
        <div className="demoChatCard">
          <span>Ask anything</span>
          <div className="demoChatDivider" />
          <small>No conversation session supplied.</small>
          <button type="button" aria-label="Send">↑</button>
        </div>
      </section>

      <section className="demoCenterPanel">
        <header className="demoFileHeader">
          <div>
            <strong>generated/previews/sample-landing-page.html</strong>
            <span>130 lines · {SAMPLE_HTML.length.toLocaleString()} chars · brainstorm</span>
          </div>
          <div className="demoHeaderActions"><button>Copy</button><button>Download</button><button>Edit</button></div>
        </header>
        <div className="demoCodeMeta">Ln 1, Col 1 <span>brainstorm · current</span></div>
        <pre className="demoCodePreview">{SAMPLE_HTML}</pre>
        <nav className="demoTabs" aria-label="Builder tabs">
          <button>Code Editor</button><button>Diff</button><button className="active">Logs</button><button>Media</button><button>DevTools</button><button>Frontend UI</button>
        </nav>
        <section className="demoLogs">
          {LOGS.map((message, index) => (
            <div key={message}><time>{`11:3${index}:0${index} PM`}</time><span>{message}</span></div>
          ))}
        </section>
        <footer className="demoBottomBar">
          <span><i />sample-landing-page.html</span>
          <button>Refresh</button>
          <label>Workspace <select defaultValue="Primary Builder"><option>Primary Builder</option></select></label>
          <label>View <select defaultValue="Single"><option>Single</option></select></label>
        </footer>
      </section>

      <section className="demoVisualPanel">
        <header className="demoVisualHeader">
          <div><strong>Visual Editor Visual Editing</strong><span>No repo · No branch · brainstorm preview</span></div>
          <nav><button className="active">Front View</button><button>Browser Review</button><button>Mobile</button><button>Advanced</button><button>Code</button><button>Split</button></nav>
        </header>
        <div className="demoVisualStatus">Draft: visual placeholder · Preview: ready · Commit: none</div>
        <div className="demoVisualActions"><button>Save Draft</button><button>Generate Patch</button><button>Push GitHub</button><button>Reset</button><button>Refresh</button><button>Operations</button></div>
        <iframe title="Sample landing page preview" srcDoc={SAMPLE_HTML} />
      </section>

      <style>{`
        *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#020713}.demoBuilderShell{width:100vw;height:100dvh;display:grid;grid-template-columns:26% 37% 37%;background:#172033;color:#e5eefb;font-family:Arial,sans-serif;overflow:hidden}.demoChatPanel,.demoCenterPanel,.demoVisualPanel{min-width:0;min-height:0;background:#020713}.demoChatPanel{padding:72px 14px 14px}.demoChatCard{position:relative;height:130px;border:1px solid #6d3fb4;border-radius:20px;padding:20px;color:#9aa9c7;background:#11152d}.demoChatDivider{height:1px;background:#25304b;margin:28px 0 18px}.demoChatCard small{font-size:10px}.demoChatCard button{position:absolute;right:14px;bottom:14px;width:42px;height:42px;border:0;border-radius:14px;background:linear-gradient(135deg,#51328f,#245ab5);color:white;font-size:22px}.demoCenterPanel{display:grid;grid-template-rows:auto auto minmax(180px,.58fr) auto minmax(160px,.42fr) auto;border-left:1px solid #20304c;border-right:1px solid #20304c}.demoFileHeader{display:flex;justify-content:space-between;gap:12px;padding:12px 14px;background:#f7fafc;color:#111827;border-bottom:1px solid #cbd5e1}.demoFileHeader div:first-child{display:grid;gap:4px}.demoFileHeader span{font-size:11px;color:#64748b}.demoHeaderActions{display:flex;gap:6px}.demoHeaderActions button,.demoTabs button,.demoBottomBar button,.demoVisualPanel button{border:1px solid #2c4264;border-radius:8px;background:#071124;color:#e8f1ff;padding:7px 10px;font-size:11px}.demoCodeMeta{display:flex;justify-content:space-between;padding:8px 12px;background:#fff;color:#4b5563;border-bottom:1px solid #cbd5e1;font-size:12px}.demoCodePreview{margin:0;padding:14px 18px;overflow:auto;background:#0b1018;color:#dbeafe;font:11px/1.45 Consolas,monospace;white-space:pre}.demoTabs{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:8px 10px;border-top:1px solid #234; border-bottom:1px solid #234}.demoTabs button{border-color:transparent;background:transparent;color:#37f0be;font-weight:700}.demoTabs button.active,.demoVisualHeader button.active{border-color:#20c997;background:#083b3a}.demoLogs{overflow:auto;padding:8px 10px;background:#030817}.demoLogs div{display:grid;grid-template-columns:100px 1fr;gap:16px;padding:11px 8px;border-bottom:1px solid #111d34;font-size:12px}.demoLogs time{color:#69b8ff}.demoLogs span{color:#fff}.demoBottomBar{display:flex;align-items:center;gap:8px;padding:8px 10px;border-top:1px solid #234;background:#020617}.demoBottomBar>span{margin-right:auto;border:1px solid #263750;border-radius:8px;padding:8px 10px;font-size:11px}.demoBottomBar i{display:inline-block;width:9px;height:9px;border-radius:50%;background:#f5a400;margin-right:6px}.demoBottomBar label{display:flex;align-items:center;gap:5px;font-size:9px;text-transform:uppercase;color:#9fb5d6}.demoBottomBar select{height:30px;background:#071124;color:white;border:1px solid #2c4264;border-radius:7px}.demoVisualPanel{display:grid;grid-template-rows:auto auto auto minmax(0,1fr)}.demoVisualHeader{display:flex;justify-content:space-between;gap:12px;padding:10px 12px;border-bottom:1px solid #22314d}.demoVisualHeader>div{display:grid;gap:4px}.demoVisualHeader span{font-size:10px;color:#8fa3bf}.demoVisualHeader nav{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.demoVisualStatus{padding:8px 12px;font-size:10px;color:#92a5c0;border-bottom:1px solid #22314d}.demoVisualActions{display:flex;gap:7px;padding:8px 12px;border-bottom:1px solid #22314d}.demoVisualPanel iframe{width:100%;height:100%;border:0;background:white}@media(max-width:1100px){.demoBuilderShell{grid-template-columns:0 50% 50%}.demoChatPanel{display:none}}@media(max-width:760px){html,body{overflow:auto}.demoBuilderShell{height:auto;min-height:100dvh;grid-template-columns:1fr;overflow:visible}.demoCenterPanel,.demoVisualPanel{min-height:700px}.demoVisualPanel{min-height:760px}}
      `}</style>
    </main>
  );
}
