"use client";

import { ChangeEvent, UIEvent, useEffect, useMemo, useRef } from "react";

type GitHubStyleCodeEditorProps = {
  value: string;
  onChange: (value: string) => void;
  filePath?: string;
  readOnly?: boolean;
  highlightStartLine?: number;
  highlightEndLine?: number;
};

function safeLine(value: number | undefined, lineCount: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(Math.floor(value || 0), 1), lineCount);
}

export default function GitHubStyleCodeEditor({ value, onChange, filePath, readOnly = false, highlightStartLine, highlightEndLine }: GitHubStyleCodeEditorProps) {
  const lineGutterRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lines = useMemo(() => value.split("\n"), [value]);
  const lineCount = Math.max(lines.length, 1);
  const startLine = safeLine(highlightStartLine, lineCount);
  const endLine = safeLine(highlightEndLine || highlightStartLine, lineCount);
  const hasHighlight = startLine > 0 && endLine >= startLine;

  function syncScroll(event: UIEvent<HTMLTextAreaElement>) {
    if (!lineGutterRef.current) return;
    lineGutterRef.current.scrollTop = event.currentTarget.scrollTop;
  }

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    onChange(event.target.value);
  }

  useEffect(() => {
    if (!hasHighlight || !textareaRef.current) return;
    const top = Math.max((startLine - 4) * 20, 0);
    textareaRef.current.scrollTop = top;
    if (lineGutterRef.current) lineGutterRef.current.scrollTop = top;
  }, [hasHighlight, startLine]);

  return (
    <section className="githubCodeEditor" aria-label={`GitHub-style code editor${filePath ? ` for ${filePath}` : ""}`}>
      <header className="githubCodeHeader">
        <span className="blobIcon">▣</span>
        <strong>{filePath || "source file"}</strong>
        <span>{lineCount.toLocaleString()} lines</span>
      </header>
      <div className="githubBlobFrame">
        <div ref={lineGutterRef} className="lineNumbers" aria-hidden="true">
          {Array.from({ length: lineCount }, (_, index) => {
            const line = index + 1;
            const highlighted = hasHighlight && line >= startLine && line <= endLine;
            return <span key={line} className={highlighted ? "highlighted" : ""}>{line}</span>;
          })}
        </div>
        <textarea
          ref={textareaRef}
          className="codeTextarea"
          value={value}
          onChange={handleChange}
          onScroll={syncScroll}
          spellCheck={false}
          readOnly={readOnly}
          aria-label="Editable source code with GitHub-style line numbers"
        />
      </div>
      <style jsx>{`
        .githubCodeEditor{height:100%;min-height:0;display:grid;grid-template-rows:40px minmax(0,1fr);background:#ffffff;color:#1f2328;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}
        .githubCodeHeader{min-width:0;height:40px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #d8dee4;background:#f6f8fa;padding:0 12px;box-sizing:border-box;color:#57606a;font-size:12px;}
        .githubCodeHeader strong{min-width:0;color:#24292f;font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .githubCodeHeader span:last-child{margin-left:auto;white-space:nowrap;color:#57606a;}
        .blobIcon{width:18px;height:18px;display:grid;place-items:center;border:1px solid #d0d7de;border-radius:6px;background:#ffffff;color:#57606a;font-size:10px;line-height:1;}
        .githubBlobFrame{min-width:0;min-height:0;display:grid;grid-template-columns:72px minmax(0,1fr);overflow:hidden;background:#ffffff;}
        .lineNumbers{min-width:0;min-height:0;overflow:hidden;border-right:1px solid #d8dee4;background:#ffffff;padding:8px 0 24px;box-sizing:border-box;font-family:ui-monospace,SFMono-Regular,SFMono-Regular,Consolas,"Liberation Mono",Menlo,monospace;font-size:12px;line-height:20px;color:#6e7781;text-align:right;user-select:none;}
        .lineNumbers span{display:block;height:20px;padding:0 16px 0 8px;box-sizing:border-box;}
        .lineNumbers span.highlighted{background:#fff8c5;color:#24292f;font-weight:700;box-shadow:inset 3px 0 0 #d29922;}
        .codeTextarea{width:100%;height:100%;min-width:0;min-height:0;border:0;outline:0;resize:none;background:#ffffff;color:#24292f;padding:8px 16px 24px;box-sizing:border-box;overflow:auto;font-family:ui-monospace,SFMono-Regular,SFMono-Regular,Consolas,"Liberation Mono",Menlo,monospace;font-size:12px;line-height:20px;tab-size:2;white-space:pre;}
        .codeTextarea::selection{background:#b6d7ff;}
      `}</style>
    </section>
  );
}
