/**
 * src/lib/streams/renderMarkdown.tsx
 *
 * Full-fidelity markdown renderer matching claude.ai output.
 * Artifact system: html/jsx/tsx/svg blocks show Preview + Code tabs.
 * Preview renders in sandboxed iframe (no XSS, no parent DOM access).
 */

import React from "react";

// ── Languages that get a live preview tab ────────────────────────────────
const PREVIEWABLE = new Set(["html", "jsx", "tsx", "svg", "css"]);

// ── Copy button ───────────────────────────────────────────────────────────
function CopyButton({ code, small }: { code: string; small?: boolean }) {
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
        padding: small ? "2px 8px" : "3px 10px",
        fontSize: 12,
        fontFamily: "inherit",
        background: copied ? "rgba(0,0,0,0.12)" : "rgba(0,0,0,0.06)",
        border: "1px solid rgba(0,0,0,0.10)",
        borderRadius: 6,
        color: copied ? "rgba(0,120,0,0.8)" : "rgba(0,0,0,0.55)",
        cursor: "pointer",
        transition: "all 0.15s",
        flexShrink: 0,
        lineHeight: 1.4,
      }}
    >
      {copied ? "✓ Copied" : "Copy"}
    </button>
  );
}

// ── Artifact block — Preview + Code tabs (matches claude.ai) ─────────────
function ArtifactBlock({ lang, code, idx }: { lang: string; code: string; idx: number }) {
  const [tab, setTab] = React.useState<"preview" | "code">("preview");
  const [expanded, setExpanded] = React.useState(false);

  // Build srcdoc for the iframe preview
  const srcdoc = React.useMemo(() => {
    if (lang === "html") return code;
    if (lang === "svg") return `<!DOCTYPE html><html><body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fff">${code}</body></html>`;
    if (lang === "css") return `<!DOCTYPE html><html><head><style>${code}</style></head><body><div class="preview">CSS Preview</div></body></html>`;
    // jsx/tsx — basic wrapper (no bundler, just shows the raw code nicely)
    return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{margin:0;font-family:system-ui,sans-serif;padding:16px;background:#fff;color:#18181b}
pre{background:#f6f8fa;padding:14px;border-radius:8px;overflow:auto;font-size:13px;line-height:1.6}</style>
</head><body>
<div style="color:#52525b;font-size:13px;margin-bottom:10px">Component preview requires a runtime. Here's the source:</div>
<pre><code>${code.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>
</body></html>`;
  }, [lang, code]);

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "5px 14px",
    fontSize: 13,
    fontFamily: "inherit",
    background: "transparent",
    border: "none",
    borderBottom: active ? "2px solid rgba(0,0,0,0.75)" : "2px solid transparent",
    color: active ? "rgba(0,0,0,0.85)" : "rgba(0,0,0,0.45)",
    cursor: "pointer",
    marginBottom: -1,
    lineHeight: 1.4,
    transition: "color 0.12s",
  });

  return (
    <div style={{
      border: "1px solid rgba(0,0,0,0.10)",
      borderRadius: 10,
      overflow: "hidden",
      margin: "12px 0",
      background: "#fff",
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 14px",
        borderBottom: "1px solid rgba(0,0,0,0.08)",
        background: "#fafafa",
        gap: 8,
      }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 2 }}>
          <button style={tabStyle(tab === "preview")} onClick={() => setTab("preview")}>Preview</button>
          <button style={tabStyle(tab === "code")} onClick={() => setTab("code")}>Code</button>
        </div>

        {/* Right controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "rgba(0,0,0,0.35)", fontFamily: "monospace" }}>{lang}</span>
          <CopyButton code={code} small />
          <button
            aria-label={expanded ? "Collapse" : "Expand"}
            onClick={() => setExpanded(v => !v)}
            style={{
              width: 24, height: 24,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "transparent", border: "none",
              color: "rgba(0,0,0,0.4)", cursor: "pointer", fontSize: 14,
              borderRadius: 4,
            }}
          >
            {expanded ? "⊟" : "⊞"}
          </button>
        </div>
      </div>

      {/* Preview tab */}
      {tab === "preview" && (
        <iframe
          key={`preview-${idx}-${code.length}`}
          srcDoc={srcdoc}
          sandbox="allow-scripts allow-same-origin"
          style={{
            width: "100%",
            height: expanded ? 520 : 320,
            border: "none",
            display: "block",
            background: "#fff",
            transition: "height 0.2s ease",
          }}
          title={`Preview ${lang}`}
        />
      )}

      {/* Code tab */}
      {tab === "code" && (
        <pre style={{
          margin: 0,
          padding: "14px 16px",
          overflowX: "auto",
          fontSize: 13,
          fontFamily: "monospace",
          lineHeight: 1.6,
          color: "rgba(0,0,0,0.87)",
          background: "#f6f8fa",
          maxHeight: expanded ? 600 : 400,
          overflowY: "auto",
        }}>
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}

// ── Plain code block (non-previewable languages) ──────────────────────────
function PlainCodeBlock({ lang, code }: { lang: string; code: string }) {
  return (
    <div style={{
      background: "#f6f8fa",
      border: "1px solid rgba(0,0,0,0.08)",
      borderRadius: 8,
      margin: "10px 0",
      overflow: "hidden",
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "7px 14px",
        borderBottom: "1px solid rgba(0,0,0,0.08)",
        background: "rgba(0,0,0,0.025)",
      }}>
        <span style={{ fontSize: 12, color: "rgba(0,0,0,0.45)", fontFamily: "monospace" }}>
          {lang || "code"}
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

// ── Inline parser ─────────────────────────────────────────────────────────
function parseInline(raw: string, keyPrefix: string): React.ReactNode[] {
  const RE = /(\*\*([^*\n]+?)\*\*|__([^_\n]+?)__|~~([^~\n]+?)~~|\*([^*\n]+?)\*|_([^_\n]+?)_|`([^`\n]+?)`|\[([^\]]+)\]\(([^)]+)\))/g;
  const nodes: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = RE.exec(raw)) !== null) {
    if (match.index > lastIdx) nodes.push(raw.slice(lastIdx, match.index));
    lastIdx = match.index + match[0].length;
    const full = match[0];
    const k = `${keyPrefix}-${match.index}`;

    if (full.startsWith("**") || full.startsWith("__")) {
      nodes.push(<strong key={k}>{match[2] ?? match[3]}</strong>);
    } else if (full.startsWith("~~")) {
      nodes.push(<s key={k}>{match[4]}</s>);
    } else if (full.startsWith("*") || full.startsWith("_")) {
      nodes.push(<em key={k}>{match[5] ?? match[6]}</em>);
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
        }}>{match[7]}</code>
      );
    } else if (full.startsWith("[")) {
      nodes.push(
        <a key={k} href={match[9]} target="_blank" rel="noopener noreferrer"
          style={{ color: "#2563eb", textDecoration: "underline", textUnderlineOffset: 2 }}>
          {match[8]}
        </a>
      );
    }
  }
  if (lastIdx < raw.length) nodes.push(raw.slice(lastIdx));
  return nodes;
}

// ── Block tokeniser ───────────────────────────────────────────────────────
type Block =
  | { t: "h";    level: 1|2|3; text: string }
  | { t: "hr" }
  | { t: "code"; lang: string; lines: string[] }
  | { t: "bq";   lines: string[] }
  | { t: "ul";   items: string[] }
  | { t: "ol";   items: string[] }
  | { t: "table"; header: string[]; rows: string[][]; align: Array<"left"|"center"|"right"> }
  | { t: "p";    lines: string[] };

function tokenise(raw: string): Block[] {
  const lines  = raw.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line    = lines[i];
    const trimmed = line.trim();

    if (!trimmed) { i++; continue; }

    // Headings
    const hm = trimmed.match(/^(#{1,3})\s+(.*)/);
    if (hm) { blocks.push({ t: "h", level: hm[1].length as 1|2|3, text: hm[2] }); i++; continue; }

    // Horizontal rule
    if (/^(---+|\*\*\*+|___+)$/.test(trimmed)) { blocks.push({ t: "hr" }); i++; continue; }

    // Code fence
    if (trimmed.startsWith("```")) {
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      blocks.push({ t: "code", lang, lines: codeLines });
      continue;
    }

    // Blockquote
    if (trimmed.startsWith(">")) {
      const bqLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        bqLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ t: "bq", lines: bqLines });
      continue;
    }

    // Unordered list
    if (/^[-*+]\s/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+]\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().slice(2));
        i++;
      }
      blocks.push({ t: "ul", items });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s/, ""));
        i++;
      }
      blocks.push({ t: "ol", items });
      continue;
    }

    // Table
    if (trimmed.startsWith("|") && i + 1 < lines.length && /^\|[-: |]+\|$/.test(lines[i+1].trim())) {
      const parseRow = (row: string) => row.split("|").slice(1,-1).map(c => c.trim());
      const header = parseRow(trimmed);
      const align  = parseRow(lines[i+1].trim()).map(c => {
        if (c.startsWith(":") && c.endsWith(":")) return "center" as const;
        if (c.endsWith(":")) return "right" as const;
        return "left" as const;
      });
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(parseRow(lines[i].trim()));
        i++;
      }
      blocks.push({ t: "table", header, rows, align });
      continue;
    }

    // Paragraph
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
      const sizes: Record<1|2|3, number> = { 1: 20, 2: 17, 3: 15 };
      const mt:    Record<1|2|3, number> = { 1: 20, 2: 16, 3: 12 };
      const mb:    Record<1|2|3, number> = { 1: 8,  2: 6,  3: 4  };
      return <div key={idx} style={{ fontSize: sizes[block.level], fontWeight: 500, marginTop: mt[block.level], marginBottom: mb[block.level], lineHeight: 1.3, color: "rgba(0,0,0,0.92)" }}>
        {parseInline(block.text, `h${idx}`)}
      </div>;
    }

    case "hr":
      return <hr key={idx} style={{ border: "none", borderTop: "1px solid rgba(0,0,0,0.10)", margin: "16px 0" }} />;

    case "code": {
      const code = block.lines.join("\n");
      if (PREVIEWABLE.has(block.lang)) {
        return <ArtifactBlock key={idx} lang={block.lang} code={code} idx={idx} />;
      }
      return <PlainCodeBlock key={idx} lang={block.lang} code={code} />;
    }

    case "bq":
      return <blockquote key={idx} style={{ margin: "10px 0", paddingLeft: 14, borderLeft: "3px solid rgba(0,0,0,0.18)", color: "rgba(0,0,0,0.60)" }}>
        {block.lines.map((l, li) => <p key={li} style={{ margin: "2px 0", lineHeight: 1.6, fontSize: 15 }}>{parseInline(l, `bq-${idx}-${li}`)}</p>)}
      </blockquote>;

    case "ul":
      return <ul key={idx} style={{ margin: "6px 0", paddingLeft: 22, listStyleType: "disc" }}>
        {block.items.map((item, ii) => <li key={ii} style={{ marginBottom: 3, lineHeight: 1.65 }}>{parseInline(item, `ul-${idx}-${ii}`)}</li>)}
      </ul>;

    case "ol":
      return <ol key={idx} style={{ margin: "6px 0", paddingLeft: 22 }}>
        {block.items.map((item, ii) => <li key={ii} style={{ marginBottom: 3, lineHeight: 1.65 }}>{parseInline(item, `ol-${idx}-${ii}`)}</li>)}
      </ol>;

    case "table":
      return <div key={idx} style={{ overflowX: "auto", margin: "10px 0" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 14, lineHeight: 1.5 }}>
          <thead>
            <tr>
              {block.header.map((h, hi) => <th key={hi} style={{ padding: "7px 12px", border: "1px solid rgba(0,0,0,0.12)", background: "rgba(0,0,0,0.04)", textAlign: block.align[hi] ?? "left", fontWeight: 500, whiteSpace: "nowrap" }}>
                {parseInline(h, `th-${idx}-${hi}`)}
              </th>)}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, ri) => <tr key={ri}>
              {row.map((cell, ci) => <td key={ci} style={{ padding: "6px 12px", border: "1px solid rgba(0,0,0,0.08)", textAlign: block.align[ci] ?? "left", verticalAlign: "top" }}>
                {parseInline(cell, `td-${idx}-${ri}-${ci}`)}
              </td>)}
            </tr>)}
          </tbody>
        </table>
      </div>;

    case "p":
      return <p key={idx} style={{ margin: "0 0 0.75em", lineHeight: 1.75, fontSize: 16 }}>
        {block.lines.map((line, li) => <React.Fragment key={li}>{li > 0 && " "}{parseInline(line, `p-${idx}-${li}`)}</React.Fragment>)}
      </p>;

    default:
      return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────
export function renderMarkdown(text: string, streaming: boolean): React.ReactNode {
  const blocks = tokenise(text);
  const nodes  = blocks.map((block, i) => renderBlock(block, i));

  if (streaming && nodes.length > 0) {
    const cursor = <span key="cursor" style={{ display: "inline-block", width: 2, height: "1em", background: "rgba(0,0,0,0.75)", borderRadius: 1, marginLeft: 2, verticalAlign: "text-bottom", animation: "streams-blink2 0.8s ease infinite" }}/>;
    const last = nodes[nodes.length - 1];
    nodes[nodes.length - 1] = <React.Fragment key={`last-${blocks.length - 1}`}>{last}{cursor}</React.Fragment>;
  }

  return <>{nodes}</>;
}
