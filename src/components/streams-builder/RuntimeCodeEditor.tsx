"use client";

import Editor from "@monaco-editor/react";
import { useEffect, useMemo, useRef, useState } from "react";

type CodeSelection = {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  text: string;
};

type RuntimeCodeEditorProps = {
  value: string;
  filePath: string;
  sha?: string;
  onChange: (nextValue: string) => void;
  onSelectionChange?: (selection: CodeSelection | null) => void;
  highlightRange?: { startLine: number; endLine: number } | null;
};

function languageFromPath(path: string) {
  if (/\.tsx?$/.test(path)) return "typescript";
  if (/\.jsx?$/.test(path)) return "javascript";
  if (/\.css$/.test(path)) return "css";
  if (/\.json$/.test(path)) return "json";
  if (/\.mdx?$/.test(path)) return "markdown";
  return "plaintext";
}

function lineCount(value: string) {
  return Math.max(value.split("\n").length, 1);
}

function downloadTextFile(filePath: string, value: string) {
  const blob = new Blob([value], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filePath.split("/").pop() || "source.txt";
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function RuntimeCodeEditor({ value, filePath, sha, onChange, onSelectionChange, highlightRange }: RuntimeCodeEditorProps) {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const decorationsRef = useRef<string[]>([]);
  const [selection, setSelection] = useState<CodeSelection | null>(null);
  const [status, setStatus] = useState("Ready");
  const language = useMemo(() => languageFromPath(filePath), [filePath]);

  function readSelection(editor = editorRef.current): CodeSelection | null {
    if (!editor) return null;
    const model = editor.getModel();
    const raw = editor.getSelection();
    if (!model || !raw) return null;
    const selectedText = model.getValueInRange(raw);
    const next = {
      startLine: raw.startLineNumber,
      startColumn: raw.startColumn,
      endLine: raw.endLineNumber,
      endColumn: raw.endColumn,
      text: selectedText,
    };
    setSelection(next);
    onSelectionChange?.(next);
    return next;
  }

  function clearDecorations() {
    const editor = editorRef.current;
    if (!editor) return;
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
  }

  function decorateSelection(kind: "highlight" | "underline" | "circle") {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const current = readSelection(editor);
    if (!editor || !monaco || !current) return;
    const range = new monaco.Range(current.startLine, current.startColumn, current.endLine, current.endColumn);
    const lineRange = new monaco.Range(current.startLine, 1, current.endLine, 1);
    const decoration = kind === "underline"
      ? { range, options: { inlineClassName: "streams-ai-underline" } }
      : kind === "circle"
        ? { range: lineRange, options: { isWholeLine: true, className: "streams-ai-circle-line", glyphMarginClassName: "streams-ai-circle-glyph" } }
        : { range: lineRange, options: { isWholeLine: true, className: "streams-ai-highlight-line", glyphMarginClassName: "streams-ai-highlight-glyph" } };
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, [decoration]);
    setStatus(`${kind} applied to lines ${current.startLine}-${current.endLine}`);
  }

  async function copyText(text: string, label: string) {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setStatus(`${label} copied`);
  }

  function copyCurrentLine() {
    const editor = editorRef.current;
    const model = editor?.getModel();
    const position = editor?.getPosition();
    if (!model || !position) return;
    const text = model.getLineContent(position.lineNumber);
    void copyText(text, `Line ${position.lineNumber}`);
  }

  function copySelection() {
    const current = readSelection();
    if (!current?.text) return;
    void copyText(current.text, `Lines ${current.startLine}-${current.endLine}`);
  }

  function handleMount(editor: any, monaco: any) {
    editorRef.current = editor;
    monacoRef.current = monaco;
    editor.onDidChangeCursorSelection(() => readSelection(editor));
    editor.onDidFocusEditorText(() => readSelection(editor));
    readSelection(editor);
  }

  useEffect(() => {
    if (!highlightRange || !editorRef.current || !monacoRef.current) return;
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const range = new monaco.Range(highlightRange.startLine, 1, highlightRange.endLine, 1);
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, [{ range, options: { isWholeLine: true, className: "streams-ai-highlight-line", glyphMarginClassName: "streams-ai-highlight-glyph" } }]);
    editor.revealLineInCenter(highlightRange.startLine);
  }, [highlightRange]);

  return (
    <section className="runtimeCodeEditor" aria-label={`Runtime code editor for ${filePath}`}>
      <header className="codeToolbar">
        <div className="fileMeta">
          <b>{filePath || "No file selected"}</b>
          <span>{lineCount(value).toLocaleString()} lines · {value.length.toLocaleString()} chars · {sha || "missing SHA"}</span>
        </div>
        <div className="tools">
          <button type="button" onClick={copyCurrentLine}>Copy line</button>
          <button type="button" onClick={copySelection} disabled={!selection?.text}>Copy selection</button>
          <button type="button" onClick={() => decorateSelection("highlight")}>Highlight</button>
          <button type="button" onClick={() => decorateSelection("circle")}>Circle</button>
          <button type="button" onClick={() => decorateSelection("underline")}>Underline</button>
          <button type="button" onClick={clearDecorations}>Clear marks</button>
          <button type="button" onClick={() => downloadTextFile(filePath, value)}>Download</button>
        </div>
      </header>
      <div className="selectionBar">
        <span>{selection ? `Selected lines ${selection.startLine}-${selection.endLine}, columns ${selection.startColumn}-${selection.endColumn}` : "Click in code to select a range"}</span>
        <span>{status}</span>
      </div>
      <div className="editorFrame">
        <Editor
          height="100%"
          language={language}
          value={value}
          onChange={(next) => onChange(next || "")}
          onMount={handleMount}
          options={{
            automaticLayout: true,
            minimap: { enabled: false },
            fontSize: 12,
            fontFamily: "ui-monospace, SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace",
            lineNumbers: "on",
            glyphMargin: true,
            folding: true,
            scrollBeyondLastLine: false,
            wordWrap: "off",
            tabSize: 2,
            insertSpaces: true,
            renderLineHighlight: "all",
            roundedSelection: false,
            overviewRulerBorder: false,
          }}
        />
      </div>
      <style jsx>{`
        .runtimeCodeEditor{height:100%;min-height:0;display:grid;grid-template-rows:auto auto minmax(0,1fr);background:#0d1117;color:#e6edf3;overflow:hidden;border:1px solid #30363d;border-radius:12px;}
        .codeToolbar{min-width:0;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;background:#161b22;border-bottom:1px solid #30363d;}
        .fileMeta{min-width:0;display:grid;gap:2px;}.fileMeta b{min-width:0;color:#f0f6fc;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}.fileMeta span{color:#8b949e;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .tools{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;}.tools button{height:28px;border:1px solid #30363d;border-radius:6px;background:#21262d;color:#c9d1d9;font-size:11px;font-weight:700;padding:0 9px;cursor:pointer;}.tools button:disabled{opacity:.45;cursor:not-allowed;}.tools button:hover:not(:disabled){background:#30363d;color:#fff;}
        .selectionBar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 12px;background:#0d1117;border-bottom:1px solid #30363d;color:#8b949e;font-size:11px;}.selectionBar span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .editorFrame{min-width:0;min-height:0;overflow:hidden;background:#0d1117;}
        :global(.streams-ai-highlight-line){background:rgba(255,248,197,.38)!important;}
        :global(.streams-ai-highlight-glyph){background:#d29922;border-radius:999px;margin-left:7px;width:9px!important;height:9px!important;margin-top:5px;}
        :global(.streams-ai-underline){text-decoration:underline 2px #f59e0b;text-underline-offset:3px;}
        :global(.streams-ai-circle-line){box-shadow:inset 0 0 0 2px rgba(56,139,253,.45);background:rgba(56,139,253,.12)!important;}
        :global(.streams-ai-circle-glyph:after){content:"";display:block;width:12px;height:12px;border:2px solid #58a6ff;border-radius:999px;margin-left:5px;margin-top:3px;}
      `}</style>
    </section>
  );
}
