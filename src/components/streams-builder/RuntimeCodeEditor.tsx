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

type CursorStatus = {
  line: number;
  column: number;
  offset: number;
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

function shortSha(value?: string) {
  return value ? value.slice(0, 7) : "no-sha";
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
  const [cursor, setCursor] = useState<CursorStatus>({ line: 1, column: 1, offset: 0 });
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [matchCount, setMatchCount] = useState(0);
  const [editMenuOpen, setEditMenuOpen] = useState(false);
  const language = useMemo(() => languageFromPath(filePath), [filePath]);

  function updateCursor(editor = editorRef.current) {
    const model = editor?.getModel();
    const position = editor?.getPosition();
    if (!model || !position) return;
    const offset = model.getOffsetAt(position);
    setCursor({ line: position.lineNumber, column: position.column, offset });
  }

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
    updateCursor(editor);
    return next;
  }

  function runEditorAction(actionId: string, label: string) {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const action = editor.getAction(actionId);
    if (action) {
      void action.run();
      setStatus(label);
    }
  }

  function selectAll() {
    runEditorAction("editor.action.selectAll", "All code selected");
    setTimeout(() => readSelection(), 0);
  }

  function undo() {
    runEditorAction("undo", "Undo applied");
  }

  function redo() {
    runEditorAction("redo", "Redo applied");
  }

  function openFind() {
    setFindOpen(true);
    runEditorAction("actions.find", "Find opened");
  }

  function findNext() {
    runEditorAction("editor.action.nextMatchFindAction", "Next match");
  }

  function findPrevious() {
    runEditorAction("editor.action.previousMatchFindAction", "Previous match");
  }

  function clearDecorations() {
    const editor = editorRef.current;
    if (!editor) return;
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
    setMatchCount(0);
    setStatus("Marks cleared");
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

  function highlightFindMatches(query = findQuery) {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor?.getModel();
    if (!editor || !monaco || !model || !query.trim()) {
      clearDecorations();
      return;
    }
    const matches = model.findMatches(query, false, false, false, null, true).slice(0, 500);
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, matches.map((match: any) => ({
      range: match.range,
      options: { inlineClassName: "streams-ai-find-match" },
    })));
    setMatchCount(matches.length);
    if (matches[0]) {
      editor.setSelection(matches[0].range);
      editor.revealRangeInCenter(matches[0].range);
    }
    setStatus(`${matches.length} match${matches.length === 1 ? "" : "es"} found`);
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

  function copyAll() {
    void copyText(value, "Full file");
  }

  function handleMount(editor: any, monaco: any) {
    editorRef.current = editor;
    monacoRef.current = monaco;
    editor.onDidChangeCursorPosition(() => updateCursor(editor));
    editor.onDidChangeCursorSelection(() => readSelection(editor));
    editor.onDidFocusEditorText(() => readSelection(editor));
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => openFind());
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyA, () => selectAll());
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyZ, () => undo());
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyZ, () => redo());
    readSelection(editor);
    updateCursor(editor);
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
          <span>{lineCount(value).toLocaleString()} lines · {value.length.toLocaleString()} chars · {shortSha(sha)}</span>
        </div>
        <div className="iconTools">
          <button type="button" title="Copy selection" onClick={copySelection} disabled={!selection?.text}>⧉</button>
          <button type="button" title="Download file" onClick={() => downloadTextFile(filePath, value)}>⇩</button>
          <button type="button" title="Edit tools" onClick={() => setEditMenuOpen((open) => !open)}>✎</button>
          <button type="button" title="More tools" onClick={() => setEditMenuOpen((open) => !open)}>⌄</button>
        </div>
      </header>

      <div className="utilityBar">
        <div className="cursorMeta"><span>Ln {cursor.line}, Col {cursor.column}</span><span>{Math.min(cursor.offset, value.length).toLocaleString()} of {value.length.toLocaleString()} characters</span></div>
        <div className="historyMeta"><span>{shortSha(sha)} · current</span><button type="button" onClick={() => setStatus(`History ready for ${shortSha(sha)}`)}>↺ History</button></div>
      </div>

      {editMenuOpen ? (
        <div className="editMenu">
          <button type="button" onClick={selectAll}>Select all</button>
          <button type="button" onClick={copyAll}>Copy all</button>
          <button type="button" onClick={copyCurrentLine}>Copy line</button>
          <button type="button" onClick={copySelection} disabled={!selection?.text}>Copy selection</button>
          <button type="button" onClick={undo}>Undo</button>
          <button type="button" onClick={redo}>Redo</button>
          <button type="button" onClick={openFind}>Find/search</button>
        </div>
      ) : null}

      {findOpen ? (
        <div className="findBar">
          <input value={findQuery} onChange={(event) => { setFindQuery(event.target.value); highlightFindMatches(event.target.value); }} onKeyDown={(event) => { if (event.key === "Enter") findNext(); if (event.key === "Escape") setFindOpen(false); }} placeholder="Find in file" autoFocus />
          <button type="button" onClick={() => highlightFindMatches()}>Find</button>
          <button type="button" onClick={findPrevious}>↑</button>
          <button type="button" onClick={findNext}>↓</button>
          <button type="button" onClick={() => { setFindOpen(false); setFindQuery(""); clearDecorations(); }}>×</button>
          <span>{matchCount} matches</span>
        </div>
      ) : null}

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
            quickSuggestions: true,
            find: { addExtraSpaceOnTop: false, autoFindInSelection: "never" },
          }}
        />
      </div>

      <style jsx>{`
        .runtimeCodeEditor{height:100%;min-height:0;display:grid;grid-template-rows:auto auto auto auto minmax(0,1fr);background:#0d1117;color:#e6edf3;overflow:hidden;border:1px solid #30363d;border-radius:12px;}
        .codeToolbar{min-width:0;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 10px;background:#f6f8fa;border-bottom:1px solid #d0d7de;color:#24292f;}
        .fileMeta{min-width:0;display:grid;gap:2px;}.fileMeta b{min-width:0;color:#24292f;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}.fileMeta span{color:#57606a;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .iconTools{display:flex;align-items:center;gap:8px;}.iconTools button{height:32px;min-width:34px;border:1px solid #d0d7de;border-radius:10px;background:#f6f8fa;color:#57606a;font-size:18px;font-weight:800;cursor:pointer;}.iconTools button:hover:not(:disabled){background:#eef2f7;color:#24292f;}.iconTools button:disabled{opacity:.45;cursor:not-allowed;}
        .utilityBar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:7px 12px;background:#ffffff;border-bottom:1px solid #d8dee4;color:#57606a;font-size:12px;}.cursorMeta,.historyMeta{display:flex;align-items:center;gap:14px;min-width:0;}.cursorMeta span,.historyMeta span{white-space:nowrap;}.historyMeta button{border:0;background:transparent;color:#24292f;font-weight:900;cursor:pointer;font-size:13px;}
        .editMenu{display:flex;gap:6px;flex-wrap:wrap;padding:8px 10px;background:#f6f8fa;border-bottom:1px solid #d0d7de;}.editMenu button,.findBar button{height:28px;border:1px solid #d0d7de;border-radius:7px;background:#fff;color:#24292f;font-size:11px;font-weight:800;padding:0 9px;cursor:pointer;}.editMenu button:hover:not(:disabled),.findBar button:hover{background:#eef2f7;}.editMenu button:disabled{opacity:.45;cursor:not-allowed;}
        .findBar{display:grid;grid-template-columns:minmax(160px,1fr) repeat(4,auto) auto;align-items:center;gap:6px;padding:8px 10px;background:#fff8c5;border-bottom:1px solid #d4a72c;color:#24292f;font-size:11px;}.findBar input{height:30px;border:1px solid #d0d7de;border-radius:8px;background:#fff;color:#24292f;padding:0 10px;outline:none;}
        .selectionBar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 12px;background:#0d1117;border-bottom:1px solid #30363d;color:#8b949e;font-size:11px;}.selectionBar span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .editorFrame{min-width:0;min-height:0;overflow:hidden;background:#0d1117;}
        :global(.streams-ai-highlight-line){background:rgba(255,248,197,.38)!important;}
        :global(.streams-ai-highlight-glyph){background:#d29922;border-radius:999px;margin-left:7px;width:9px!important;height:9px!important;margin-top:5px;}
        :global(.streams-ai-underline){text-decoration:underline 2px #f59e0b;text-underline-offset:3px;}
        :global(.streams-ai-circle-line){box-shadow:inset 0 0 0 2px rgba(56,139,253,.45);background:rgba(56,139,253,.12)!important;}
        :global(.streams-ai-circle-glyph:after){content:"";display:block;width:12px;height:12px;border:2px solid #58a6ff;border-radius:999px;margin-left:5px;margin-top:3px;}
        :global(.streams-ai-find-match){background:rgba(255,212,59,.45);border-radius:2px;}
      `}</style>
    </section>
  );
}
