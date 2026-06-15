"use client";

export default function GitHubRepositoryPicker() {
  return (
    <section className="repoPicker" aria-label="Streams Builder repository context">
      <div>
        <b>Streams Builder</b>
        <span>Current workstation controls stay inside the workstation.</span>
      </div>
      <div>
        <b>Layout</b>
        <span>Existing chat frame plus existing workstation surface.</span>
      </div>
      <div>
        <b>Rule</b>
        <span>No outer rail. No four-equal-workstation grid.</span>
      </div>

      <style jsx>{`
        .repoPicker {
          min-width: 0;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 6px;
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 14px;
          background: rgba(15, 23, 42, 0.78);
          padding: 6px;
          box-sizing: border-box;
          overflow: hidden;
        }
        .repoPicker div {
          min-width: 0;
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 10px;
          background: #020617;
          padding: 6px;
        }
        b {
          display: block;
          color: #6ee7b7;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 3px;
        }
        span {
          display: block;
          color: #cbd5e1;
          font-size: 10px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        @media (max-width: 980px) {
          .repoPicker {
            grid-template-columns: minmax(0, 1fr);
          }
        }
      `}</style>
    </section>
  );
}
