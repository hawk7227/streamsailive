"use client";

import { VISUAL_EDITOR_BUILD_GROUPS } from "@/lib/streams-builder/visual-editor-build-groups";

export default function VisualEditorBuildGroupsPanel() {
  return (
    <section className="robustGroups" aria-label="Safe grouped visual editor build plan">
      <header className="groupHeader">
        <b>Safe grouped build 1-15</b>
        <span>{VISUAL_EDITOR_BUILD_GROUPS.length} grouped workstreams</span>
      </header>

      <div className="groupGrid">
        {VISUAL_EDITOR_BUILD_GROUPS.map((group) => (
          <article key={group.id} className="groupCard">
            <div className="cardTop">
              <strong>{group.title}</strong>
              <small>{group.items.map((item) => item.id).join(", ")}</small>
            </div>
            <p>{group.safeBuildReason}</p>
            <ul>
              {group.items.map((item) => (
                <li key={item.id}>
                  <span>{item.id}</span>
                  <label>{item.title}</label>
                  <em>{item.status}</em>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <style jsx>{`
        .robustGroups {
          margin-top: 8px;
          border: 1px solid rgba(59, 130, 246, 0.2);
          border-radius: 10px;
          padding: 8px;
          background: rgba(15, 23, 42, 0.6);
        }

        .groupHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        b {
          color: #6ee7b7;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .groupHeader span {
          color: #93c5fd;
          font-size: 9px;
          font-weight: 900;
        }

        .groupGrid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 6px;
          margin-top: 6px;
        }

        .groupCard {
          min-width: 0;
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 9px;
          background: rgba(2, 6, 23, 0.58);
          padding: 7px;
        }

        .cardTop {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 6px;
          align-items: start;
        }

        strong {
          color: #fff;
          font-size: 10px;
          line-height: 1.2;
        }

        small {
          color: #93c5fd;
          font-size: 9px;
          font-weight: 900;
        }

        p {
          color: #94a3b8;
          font-size: 9px;
          line-height: 1.25;
          margin: 5px 0 0;
        }

        ul {
          list-style: none;
          padding: 0;
          margin: 6px 0 0;
          display: grid;
          gap: 4px;
        }

        li {
          display: grid;
          grid-template-columns: 16px minmax(0, 1fr) auto;
          gap: 4px;
          align-items: center;
          color: #cbd5e1;
          font-size: 9px;
          line-height: 1.15;
        }

        li span {
          display: inline-grid;
          place-items: center;
          width: 14px;
          height: 14px;
          border-radius: 999px;
          background: rgba(16, 185, 129, 0.16);
          color: #6ee7b7;
          font-size: 8px;
          font-weight: 900;
        }

        label {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        em {
          color: #fbbf24;
          font-style: normal;
          font-size: 8px;
          text-transform: uppercase;
        }
      `}</style>
    </section>
  );
}
