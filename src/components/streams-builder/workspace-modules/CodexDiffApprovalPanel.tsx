"use client";

const DEFAULT_PROOF = [
  "Source truth pulled",
  "Rollback checkpoint ready",
  "Build/test proof required",
  "Browser screenshot proof required",
  "Diff review required",
  "Push blocked until approval",
];

export default function CodexDiffApprovalPanel() {
  return (
    <section className="approvalPanel" aria-label="Codex diff approval and rollback gate">
      <header>
        <b>Codex Approval Gate</b>
        <span>Push locked until proof passes</span>
      </header>
      <div className="approvalGrid">
        <article>
          <strong>Diff Approval</strong>
          <p>Status: awaiting build + browser proof</p>
          <p>Changed files: shown after patch generation</p>
        </article>
        <article>
          <strong>Browser Screenshot</strong>
          <p>Real artifact comes from /api/streams-builder/browser-verification</p>
          <p>Required before visual approval</p>
        </article>
        <article>
          <strong>Rollback</strong>
          <p>Checkpoint required before patch apply</p>
          <p>Restore command stored with job metadata</p>
        </article>
      </div>
      <ol>
        {DEFAULT_PROOF.map((item) => <li key={item}>{item}</li>)}
      </ol>
      <style jsx>{`
        .approvalPanel{margin-top:8px;border:1px solid rgba(251,191,36,.24);border-radius:10px;background:rgba(69,26,3,.22);padding:8px;color:#fff;}
        header{display:flex;align-items:center;justify-content:space-between;gap:8px;}
        b{color:#fde68a;font-size:10px;text-transform:uppercase;letter-spacing:.05em;}
        span{color:#fbbf24;font-size:9px;font-weight:900;}
        .approvalGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:7px;}
        article{border:1px solid rgba(251,191,36,.18);border-radius:9px;background:rgba(2,6,23,.44);padding:7px;}
        strong{display:block;color:#fff;font-size:10px;}
        p{margin:4px 0 0;color:#cbd5e1;font-size:9px;line-height:1.25;}
        ol{margin:7px 0 0;padding-left:16px;color:#cbd5e1;font-size:9px;display:grid;gap:2px;}
      `}</style>
    </section>
  );
}
