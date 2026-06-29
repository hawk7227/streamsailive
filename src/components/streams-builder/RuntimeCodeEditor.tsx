"use client";

import { ChangeEvent, KeyboardEvent, useMemo, useRef, useState } from "react";

type CodeSelection = { startLine: number; startColumn: number; endLine: number; endColumn: number; text: string };
type RuntimeCodeEditorProps = { value: string; filePath: string; sha?: string; onChange: (nextValue: string) => void; onSelectionChange?: (selection: CodeSelection | null) => void; highlightRange?: { startLine: number; endLine: number } | null };
type CursorStatus = { line: number; column: number; offset: number };

function lineCount(value: string) { return Math.max(value.split("\n").length, 1); }
function shortSha(value?: string) { return value ? value.slice(0, 7) : "no-sha"; }
function downloadTextFile(filePath: string, value: string) { const blob = new Blob([value], { type: "text/plain;charset=utf-8" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filePath.split("/").pop() || "source.txt"; a.click(); URL.revokeObjectURL(url); }
function positionFromOffset(value: string, offset: number) { const before = value.slice(0, Math.max(0, offset)); const lines = before.split("\n"); return { line: lines.length, column: (lines.at(-1)?.length || 0) + 1, offset }; }
function selectionFromTextarea(textarea: HTMLTextAreaElement): CodeSelection {
  const value = textarea.value;
  const start = textarea.selectionStart || 0;
  const end = textarea.selectionEnd || start;
  const startPos = positionFromOffset(value, start);
  const endPos = positionFromOffset(value, end);
  return { startLine: startPos.line, startColumn: startPos.column, endLine: endPos.line, endColumn: endPos.column, text: value.slice(start, end) };
}
function lineNumbers(value: string) { return Array.from({ length: lineCount(value) }, (_, index) => index + 1).join("\n"); }

export default function RuntimeCodeEditor({ value, filePath, sha, onChange, onSelectionChange, highlightRange }: RuntimeCodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const gutterRef = useRef<HTMLPreElement | null>(null);
  const [selection, setSelection] = useState<CodeSelection | null>(null);
  const [status, setStatus] = useState("Ready");
  const [cursor, setCursor] = useState<CursorStatus>({ line: 1, column: 1, offset: 0 });
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [editMenuOpen, setEditMenuOpen] = useState(false);
  const numbers = useMemo(() => lineNumbers(value || ""), [value]);

  function syncScroll() {
    if (gutterRef.current && textareaRef.current) gutterRef.current.scrollTop = textareaRef.current.scrollTop;
  }
  function updateSelection() {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const next = selectionFromTextarea(textarea);
    setSelection(next);
    setCursor(positionFromOffset(textarea.value, textarea.selectionStart || 0));
    onSelectionChange?.(next.text ? next : null);
  }
  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    onChange(event.target.value);
    window.setTimeout(updateSelection, 0);
  }
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
      event.preventDefault();
      setFindOpen(true);
      setStatus("Find opened");
    }
  }
  async function copyText(text: string, label: string) { if (!text) return; await navigator.clipboard.writeText(text); setStatus(`${label} copied`); }
  function copyCurrentLine() { const lines = (value || "").split("\n"); void copyText(lines[Math.max(0, cursor.line - 1)] || "", `Line ${cursor.line}`); }
  function copySelection() { const current = textareaRef.current ? selectionFromTextarea(textareaRef.current) : selection; if (!current?.text) return; void copyText(current.text, `Lines ${current.startLine}-${current.endLine}`); }
  function copyAll() { void copyText(value, "Full file"); }
  function selectAll() { textareaRef.current?.select(); updateSelection(); setStatus("All code selected"); }
  function clearMarks() { setFindQuery(""); setFindOpen(false); setStatus("Marks cleared"); }
  function mark(kind: string) { const current = textareaRef.current ? selectionFromTextarea(textareaRef.current) : selection; setStatus(current?.text ? `${kind} marked on lines ${current.startLine}-${current.endLine}` : `Select code before ${kind.toLowerCase()}`); }
  function findNext() {
    const textarea = textareaRef.current;
    if (!textarea || !findQuery) return;
    const start = Math.max(textarea.selectionEnd || 0, 0);
    const nextIndex = textarea.value.toLowerCase().indexOf(findQuery.toLowerCase(), start);
    const wrappedIndex = nextIndex >= 0 ? nextIndex : textarea.value.toLowerCase().indexOf(findQuery.toLowerCase(), 0);
    if (wrappedIndex < 0) { setStatus("No matches"); return; }
    textarea.focus();
    textarea.setSelectionRange(wrappedIndex, wrappedIndex + findQuery.length);
    updateSelection();
    setStatus(`Found ${findQuery}`);
  }

  return (
    <section className="runtimeCodeEditor" aria-label={`Runtime code editor for ${filePath}`}>
      <header className="codeToolbar"><div className="fileMeta"><b>{filePath || "No file selected"}</b><span>{lineCount(value).toLocaleString()} lines · {value.length.toLocaleString()} chars · {shortSha(sha)}</span></div><div className="iconTools"><button type="button" title="Copy selection" onClick={copySelection} disabled={!selection?.text}>⧉</button><button type="button" title="Download file" onClick={() => downloadTextFile(filePath, value)}>⇩</button><button type="button" title="Edit tools" onClick={() => setEditMenuOpen((open) => !open)}>✎</button><button type="button" title="More tools" onClick={() => setEditMenuOpen((open) => !open)}>⌄</button></div></header>
      <div className="utilityBar"><div className="cursorMeta"><span>Ln {cursor.line}, Col {cursor.column}</span><span>{Math.min(cursor.offset, value.length).toLocaleString()} of {value.length.toLocaleString()} characters</span></div><div className="historyMeta"><span>{shortSha(sha)} · current</span><button type="button" onClick={() => setStatus(`History ready for ${shortSha(sha)}`)}>↺ History</button></div></div>
      {editMenuOpen ? <div className="editMenu"><button type="button" onClick={selectAll}>Select all</button><button type="button" onClick={copyAll}>Copy all</button><button type="button" onClick={copyCurrentLine}>Copy line</button><button type="button" onClick={copySelection} disabled={!selection?.text}>Copy selection</button><button type="button" onClick={() => setFindOpen(true)}>Find/search</button><button type="button" onClick={() => mark("Highlight")}>Highlight</button><button type="button" onClick={() => mark("Circle")}>Circle</button><button type="button" onClick={() => mark("Underline")}>Underline</button><button type="button" onClick={clearMarks}>Clear marks</button></div> : null}
      {findOpen ? <div className="findBar"><input value={findQuery} onChange={(event) => setFindQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") findNext(); if (event.key === "Escape") setFindOpen(false); }} placeholder="Find in file" autoFocus /><button type="button" onClick={findNext}>Find</button><button type="button" onClick={clearMarks}>×</button></div> : null}
      <div className="selectionBar"><span>{selection?.text ? `Selected lines ${selection.startLine}-${selection.endLine}, columns ${selection.startColumn}-${selection.endColumn}` : highlightRange ? `Highlighted lines ${highlightRange.startLine}-${highlightRange.endLine}` : "Click in code to select a range"}</span><span>{status}</span></div>
      <div className="editorFrame">
        <pre ref={gutterRef} className="lineGutter" aria-hidden="true">{numbers}</pre>
        <textarea ref={textareaRef} value={value} onChange={handleChange} onSelect={updateSelection} onKeyUp={updateSelection} onClick={updateSelection} onScroll={syncScroll} onKeyDown={handleKeyDown} spellCheck={false} />
      </div>
      <style jsx>{`.runtimeCodeEditor{height:100%;min-height:0;display:grid;grid-template-rows:auto auto auto auto minmax(0,1fr);background:#0d1117;color:#e6edf3;overflow:hidden;border:1px solid #30363d;border-radius:12px}.codeToolbar{min-width:0;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 10px;background:#f6f8fa;border-bottom:1px solid #d0d7de;color:#24292f}.fileMeta{min-width:0;display:grid;gap:2px}.fileMeta b{min-width:0;color:#24292f;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fileMeta span{color:#57606a;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.iconTools{display:flex;align-items:center;gap:8px}.iconTools button{height:32px;min-width:34px;border:1px solid #d0d7de;border-radius:10px;background:#f6f8fa;color:#57606a;font-size:18px;font-weight:800;cursor:pointer}.iconTools button:hover:not(:disabled){background:#eef2f7;color:#24292f}.iconTools button:disabled{opacity:.45;cursor:not-allowed}.utilityBar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:7px 12px;background:#fff;border-bottom:1px solid #d8dee4;color:#57606a;font-size:12px}.cursorMeta,.historyMeta{display:flex;align-items:center;gap:14px;min-width:0}.cursorMeta span,.historyMeta span{white-space:nowrap}.historyMeta button{border:0;background:transparent;color:#24292f;font-weight:900;cursor:pointer;font-size:13px}.editMenu{display:flex;gap:6px;flex-wrap:wrap;padding:8px 10px;background:#f6f8fa;border-bottom:1px solid #d0d7de}.editMenu button,.findBar button{height:28px;border:1px solid #d0d7de;border-radius:7px;background:#fff;color:#24292f;font-size:11px;font-weight:800;padding:0 9px;cursor:pointer}.editMenu button:hover:not(:disabled),.findBar button:hover{background:#eef2f7}.editMenu button:disabled{opacity:.45;cursor:not-allowed}.findBar{display:grid;grid-template-columns:minmax(160px,1fr) auto auto;align-items:center;gap:6px;padding:8px 10px;background:#fff8c5;border-bottom:1px solid #d4a72c;color:#24292f;font-size:11px}.findBar input{height:30px;border:1px solid #d0d7de;border-radius:8px;background:#fff;color:#24292f;padding:0 10px;outline:none}.selectionBar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 12px;background:#0d1117;border-bottom:1px solid #30363d;color:#8b949e;font-size:11px}.selectionBar span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.editorFrame{min-width:0;min-height:0;display:grid;grid-template-columns:54px minmax(0,1fr);overflow:hidden;background:#0d1117}.lineGutter{margin:0;padding:10px 8px 40px 0;background:#0d1117;border-right:1px solid #30363d;color:#6e7681;text-align:right;font:12px/19px ui-monospace,SFMono-Regular,Consolas,Liberation Mono,Menlo,monospace;overflow:hidden;user-select:none}.editorFrame textarea{width:100%;height:100%;min-width:0;min-height:0;resize:none;border:0;outline:0;background:#0d1117;color:#e6edf3;padding:10px 12px 40px;font:12px/19px ui-monospace,SFMono-Regular,Consolas,Liberation Mono,Menlo,monospace;white-space:pre;overflow:auto;tab-size:2;box-sizing:border-box}.editorFrame textarea::selection{background:rgba(56,139,253,.45)}`}</style>
    </section>
  );
}
