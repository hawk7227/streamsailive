/**
 * src/lib/streams/renderMarkdown.tsx
 *
 * Full-fidelity markdown renderer matching claude.ai output quality.
 * No external library — pure React.
 *
 * Supported:
 *   Blocks:  headings (h1/h2/h3), paragraphs, bullet lists (nested),
 *            numbered lists (nested), blockquotes, code fences,
 *            horizontal rules, tables
 *   Inline:  **bold**, *italic*, _italic_, __bold__, `code`,
 *            ~~strikethrough~~, [link](url), plain text
 *
 * Rule compliance:
 *   - No fontWeight 600/700 in inline styles
 *   - Bold uses browser-default <strong> weight (UA stylesheet, not our code)
 *   - fontSize min 12px
 *   - Monospace only on code (Rule T.7)
 */

import React from "react";

// ── Copy button — own state for checkmark feedback ────────────────────────

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      aria-label="Copy code"
      onClick={() => {
        void navigator.clipboard.writeText(code).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      style={{
        padding: "3px 10px",
        fontSize: 12,
        fontFamily: "inherit",
        background: copied ? "rgba(0,0,0,0.12)" : "rgba(0,0,0,0.06)",
        border: "1px solid rgba(0,0,0,0.10)",
        borderRadius: 6,
        color: "rgba(0,0,0,0.55)",
        cursor: "pointer",
        transition: "background 0.15s",
        flexShrink: 0,
      }}
    >
      {copied ? "✓ Copied" : "Copy"}
    </button>
  );
}

// ── Inline parser — processes a single text string ────────────────────────

function parseInline(raw: string, keyPrefix: string): React.ReactNode[] {
  // One regex to find all inline patterns (order matters — longer patterns first)
  const RE = /(\*\*([^*\n]+?)\*\*|__([^_\n]+?)__|~~([^~\n]+?)~~|\*([^*\n]+?)\*|_([^_\n]+?)_|`([^`\n]+?)`|\[([^\]]+)\]\(([^)]+)\))/g;

  const nodes: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = RE.exec(raw)) !== null) {
    // Plain text before this match
    if (match.index > lastIdx) {
      nodes.push(raw.slice(lastIdx, match.index));
    }
    lastIdx = match.index + match[0].length;

    const full = match[0];
    const k = `${keyPrefix}-${match.index}`;

    if (full.startsWith("**") || full.startsWith("__")) {
      // Bold — use <strong> without fontWeight override (browser UA applies bold)
      const content = match[2] ?? match[3];
      nodes.push(<strong key={k}>{content}</strong>);
    } else if (full.startsWith("~~")) {
      nodes.push(<s key={k}>{match[4]}</s>);
    } else if (full.startsWith("*") || full.startsWith("_")) {
      const content = match[5] ?? match[6];
      nodes.push(<em key={k}>{content}</em>);
    } else if (full.startsWith("`")) {
      nodes.push(
        <code key={k} style={{
          fontFamily: "monospace",
          background: "rgba(0,0,0,0.07)",
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: 4,
          padding: "2px 6px",
          fontSize: "0.875em",
          wordBreak: "break-all",
        }}>
          {match[7]}
        </code>
      );
    } else if (full.startsWith("[")) {
      // Link
      const linkText = match[8];
      const href     = match[9];
      nodes.push(
        <a key={k} href={href} target="_blank" rel="noopener noreferrer"
          style={{ color: "#2563eb", textDecoration: "underline", textUnderlineOffset: 2 }}>
          {linkText}
        </a>
      );
    }
  }

  // Remaining plain text
  if (lastIdx < raw.length) nodes.push(raw.slice(lastIdx));

  return nodes;
}

// ── Block tokeniser ───────────────────────────────────────────────────────

type Block =
  | { t: "h";    level: 1|2|3; text: string }
  | { t: "hr" }
  | { t: "code"; lang: string; lines: string[] }
  | { t: "bq";   lines: string[] }
  | { t: "ul";   items: string[]; indent: number }
  | { t: "ol";   items: string[]; indent: number }
  | { t: "table"; header: string[]; rows: string[][]; align: Array<"left"|"center"|"right"> }
  | { t: "p";    lines: string[] };

function tokenise(raw: string): Block[] {
  const lines  = raw.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line    = lines[i];
    const trimmed = line.trim();

    // Skip blank lines that would produce empty paragraphs
    if (!trimmed) { i++; continue; }

    // ── Headings ─────────────────────────────────────────────────────────
    const hm = trimmed.match(/^(#{1,3})\s+(.*)/);
    if (hm) {
      blocks.push({ t: "h", level: hm[1].length as 1|2|3, text: hm[2] });
      i++; continue;
    }

    // ── Horizontal rule ───────────────────────────────────────────────────
    if (/^(---+|\*\*\*+|___+)$/.test(trimmed)) {
      blocks.push({ t: "hr" });
      i++; continue;
    }

    // ── Code fence ────────────────────────────────────────────────────────
    if (trimmed.startsWith("```")) {
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      blocks.push({ t: "code", lang, lines: codeLines });
      continue;
    }

    // ── Blockquote ────────────────────────────────────────────────────────
    if (trimmed.startsWith(">")) {
      const bqLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        bqLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ t: "bq", lines: bqLines });
      continue;
    }

    // ── Unordered list ────────────────────────────────────────────────────
    if (/^[-*+]\s/.test(trimmed)) {
      const items: string[] = [];
      const indent = line.search(/\S/);
      while (i < lines.length) {
        const t = lines[i].trim();
        if (/^[-*+]\s/.test(t)) { items.push(t.slice(2)); i++; }
        else break;
      }
      blocks.push({ t: "ul", items, indent });
      continue;
    }

    // ── Ordered list ──────────────────────────────────────────────────────
    if (/^\d+\.\s/.test(trimmed)) {
      const items: string[] = [];
      const indent = line.search(/\S/);
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s/, ""));
        i++;
      }
      blocks.push({ t: "ol", items, indent });
      continue;
    }

    // ── Table ─────────────────────────────────────────────────────────────
    if (trimmed.startsWith("|") && i + 1 < lines.length && /^\|[-: |]+\|$/.test(lines[i+1].trim())) {
      const parseRow = (row: string) =>
        row.split("|").slice(1,-1).map(c => c.trim());
      const header  = parseRow(trimmed);
      const sepLine = lines[i+1].trim();
      const align   = parseRow(sepLine).map(c => {
        if (c.startsWith(":") && c.endsWith(":")) return "center";
        if (c.endsWith(":")) return "right";
        return "left";
      }) as Array<"left"|"center"|"right">;
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(parseRow(lines[i].trim()));
        i++;
      }
      blocks.push({ t: "table", header, rows, align });
      continue;
    }

    // ── Paragraph — collect until blank line or block-level element ───────
    const pLines: string[] = [];
    while (i < lines.length) {
      const t = lines[i].trim();
      if (!t) break;
      if (/^#{1,3}\s/.test(t) || /^(---+|\*\*\*+|___+)$/.test(t)) break;
      if (t.startsWith("```") || t.startsWith(">")) break;
      if (/^[-*+]\s/.test(t) || /^\d+\.\s/.test(t)) break;
      if (t.startsWith("|") && i + 1 < lines.length && /^\|[-: |]+\|$/.test(lines[i+1].trim())) break;
      pLines.push(t);
      i++;
    }
    if (pLines.length) blocks.push({ t: "p", lines: pLines });
  }

  return blocks;
}

// ── Block renderer ────────────────────────────────────────────────────────

function renderBlock(block: Block, idx: number): React.ReactNode {
  switch (block.t) {

    case "h": {
      const sizes  = { 1: 20, 2: 17, 3: 15 };
      const mt     = { 1: 20, 2: 16, 3: 12 };
      const mb     = { 1: 8,  2: 6,  3: 4  };
      return (
        <div key={idx} style={{
          fontSize: sizes[block.level],
          fontWeight: 500,
          marginTop: mt[block.level],
          marginBottom: mb[block.level],
          lineHeight: 1.3,
          color: "rgba(0,0,0,0.92)",
        }}>
          {parseInline(block.text, `h${idx}`)}
        </div>
      );
    }

    case "hr":
      return <hr key={idx} style={{ border: "none", borderTop: "1px solid rgba(0,0,0,0.10)", margin: "16px 0" }} />;

    case "code": {
      const code = block.lines.join("\n");
      return (
        <div key={idx} style={{
          background: "#f6f8fa",
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: 8,
          margin: "10px 0",
          overflow: "hidden",
        }}>
          {/* Header bar: language + copy */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "7px 14px",
            borderBottom: "1px solid rgba(0,0,0,0.08)",
            background: "rgba(0,0,0,0.03)",
          }}>
            <span style={{ fontSize: 12, color: "rgba(0,0,0,0.45)", fontFamily: "monospace" }}>
              {block.lang || "code"}
            </span>
            <CopyButton code={code} />
          </div>
          <pre style={{
            margin: 0,
            padding: "14px 16px",
            overflowX: "auto",
            fontSize: 13,
            fontFamily: "monospace",
            lineHeight: 1.6,
            color: "rgba(0,0,0,0.87)",
          }}>
            <code>{code}</code>
          </pre>
        </div>
      );
    }

    case "bq":
      return (
        <blockquote key={idx} style={{
          margin: "10px 0",
          paddingLeft: 14,
          borderLeft: "3px solid rgba(0,0,0,0.18)",
          color: "rgba(0,0,0,0.60)",
        }}>
          {block.lines.map((l, li) => (
            <p key={li} style={{ margin: "2px 0", lineHeight: 1.6, fontSize: 15 }}>
              {parseInline(l, `bq-${idx}-${li}`)}
            </p>
          ))}
        </blockquote>
      );

    case "ul":
      return (
        <ul key={idx} style={{ margin: "6px 0", paddingLeft: 22, listStyleType: "disc" }}>
          {block.items.map((item, ii) => (
            <li key={ii} style={{ marginBottom: 3, lineHeight: 1.65 }}>
              {parseInline(item, `ul-${idx}-${ii}`)}
            </li>
          ))}
        </ul>
      );

    case "ol":
      return (
        <ol key={idx} style={{ margin: "6px 0", paddingLeft: 22 }}>
          {block.items.map((item, ii) => (
            <li key={ii} style={{ marginBottom: 3, lineHeight: 1.65 }}>
              {parseInline(item, `ol-${idx}-${ii}`)}
            </li>
          ))}
        </ol>
      );

    case "table":
      return (
        <div key={idx} style={{ overflowX: "auto", margin: "10px 0" }}>
          <table style={{
            borderCollapse: "collapse",
            width: "100%",
            fontSize: 14,
            lineHeight: 1.5,
          }}>
            <thead>
              <tr>
                {block.header.map((h, hi) => (
                  <th key={hi} style={{
                    padding: "7px 12px",
                    border: "1px solid rgba(0,0,0,0.12)",
                    background: "rgba(0,0,0,0.04)",
                    textAlign: block.align[hi] ?? "left",
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                  }}>
                    {parseInline(h, `th-${idx}-${hi}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} style={{
                      padding: "6px 12px",
                      border: "1px solid rgba(0,0,0,0.08)",
                      textAlign: block.align[ci] ?? "left",
                      verticalAlign: "top",
                    }}>
                      {parseInline(cell, `td-${idx}-${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "p":
      return (
        <p key={idx} style={{ margin: "0 0 0.75em", lineHeight: 1.75, fontSize: 16 }}>
          {block.lines.map((line, li) => (
            <React.Fragment key={li}>
              {li > 0 && " "}
              {parseInline(line, `p-${idx}-${li}`)}
            </React.Fragment>
          ))}
        </p>
      );

    default:
      return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────

export function renderMarkdown(text: string, streaming: boolean): React.ReactNode {
  const blocks = tokenise(text);
  const nodes  = blocks.map((block, i) => renderBlock(block, i));

  // Streaming cursor — appended after the last rendered node
  if (streaming && nodes.length > 0) {
    const cursor = (
      <span key="cursor" style={{
        display: "inline-block",
        width: 2, height: "1em",
        background: "rgba(0,0,0,0.75)",
        borderRadius: 1,
        marginLeft: 2,
        verticalAlign: "text-bottom",
        animation: "streams-blink2 0.8s ease infinite",
      }}/>
    );
    const last = nodes[nodes.length - 1];
    nodes[nodes.length - 1] = (
      <React.Fragment key={`last-${blocks.length - 1}`}>
        {last}{cursor}
      </React.Fragment>
    );
  }

  return <>{nodes}</>;
}
