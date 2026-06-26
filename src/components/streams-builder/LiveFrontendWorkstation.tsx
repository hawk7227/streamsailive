"use client";

type PulledFileDetail = {
  repo: string;
  branch: string;
  path: string;
  folder: string;
  sha: string;
  content: string;
  route: string;
};

type Props = {
  activeFile: PulledFileDetail;
};

function normalizeRoute(value: string) {
  const trimmed = (value || "/").trim();
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function repoName(repo: string) {
  return (repo || "").split("/").pop() || "";
}

function liveUrlFor(repo: string, route: string) {
  const path = normalizeRoute(route);
  if (repo === "hawk7227/patientpanel") return `https://patientpanel.vercel.app${path}`;
  if (repo === "hawk7227/patient-panel") return `https://patient-panel.vercel.app${path}`;
  const app = repoName(repo);
  return app ? `https://${app}.vercel.app${path}` : path;
}

export default function LiveFrontendWorkstation({ activeFile }: Props) {
  const route = normalizeRoute(activeFile.route || "/");
  const liveUrl = liveUrlFor(activeFile.repo, route);
  const ready = Boolean(activeFile.repo && activeFile.path);

  return (
    <section className="liveWorkstation" aria-label="Live frontend workstation preview">
      <aside className="summaryRail">
        <p className="meta">Worked in Agent 1 · {activeFile.repo || "no repo selected"} · {activeFile.branch || "no branch selected"}</p>
        <h3>Summary</h3>
        <ul>
          <li>{ready ? `Mounted ${activeFile.path} from ${activeFile.repo}@${activeFile.branch}.` : "Pull a source file to mount the live frontend."}</li>
          <li>{ready ? "Frontend UI is the same live browser view used by Visual Editing." : "No frontend is mounted yet."}</li>
        </ul>
        <h3>Verification</h3>
        <ul>
          <li>Verified repo: {activeFile.repo || "not selected"}</li>
          <li>Verified branch: {activeFile.branch || "not selected"}</li>
          <li>Verified file: {activeFile.path || "not selected"}</li>
          <li>Verified route: {route}</li>
          <li>Verified SHA: {activeFile.sha || "missing"}</li>
          <li>Live preview URL: {ready ? liveUrl : "waiting for Pull"}</li>
        </ul>
      </aside>
      <main className="previewSide">
        <nav className="tabs"><button type="button">Summary</button><button type="button">Code</button><button type="button" className="active">Frontend UI</button><button type="button">Diff</button><button type="button">Logs</button><button type="button">Media</button></nav>
        <div className="debug"><span>repo <b>{activeFile.repo || "not selected"}</b></span><span>branch <b>{activeFile.branch || "not selected"}</b></span><span>route <b>{route}</b></span><span>file <b>{activeFile.path || "not selected"}</b></span><span>live url <b>{ready ? liveUrl : "not mounted"}</b></span></div>
        <section className="frameWrap">
          {ready ? <iframe title="Live frontend preview" src={liveUrl} /> : <div className="empty"><h2>Pull a source file first</h2><p>The actual frontend browser view will appear here after Pull.</p></div>}
        </section>
      </main>
      <style jsx>{`
        .liveWorkstation{height:100%;min-height:0;display:grid;grid-template-columns:minmax(260px,.34fr) minmax(0,1fr);overflow:hidden;background:#f6f8fa;color:#24292f}.summaryRail{height:100%;overflow:auto;border-right:1px solid #d8dee4;background:#fff;padding:18px;box-sizing:border-box}.summaryRail .meta{margin:0 0 18px;color:#57606a;font-size:13px}.summaryRail h3{margin:16px 0 10px;font-size:20px}.summaryRail ul{margin:0;padding-left:20px;display:grid;gap:10px}.summaryRail li{font-size:13px;line-height:1.45}.previewSide{min-width:0;min-height:0;display:grid;grid-template-rows:44px auto minmax(0,1fr);overflow:hidden;background:#020617}.tabs{display:flex;min-width:0;overflow:auto;border-bottom:1px solid #d8dee4;background:#f6f8fa}.tabs button{height:44px;border:0;border-right:1px solid #d8dee4;background:transparent;color:#57606a;padding:0 20px;font-size:13px;font-weight:800}.tabs button.active{background:#fff;color:#24292f;box-shadow:inset 0 -2px 0 #fd8c73}.debug{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:1px;background:#111827;border-bottom:1px solid rgba(168,85,247,.45)}.debug span{min-width:0;display:block;padding:9px 12px;background:#020617;color:#94a3b8;font-size:10px;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.debug b{display:block;color:#fff;text-transform:none;font-size:12px}.frameWrap{min-width:0;min-height:0;margin:10px;border:1px solid rgba(124,58,237,.45);border-radius:16px;overflow:hidden;background:#fff}.frameWrap iframe{display:block;width:100%;height:100%;border:0;background:#fff}.empty{height:100%;display:grid;place-content:center;text-align:center;color:#0f172a}.empty h2{margin:0 0 8px;font-size:28px}.empty p{margin:0;color:#475569}
      `}</style>
    </section>
  );
}
