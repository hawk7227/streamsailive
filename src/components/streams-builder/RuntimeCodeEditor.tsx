"use client";

import { ChangeEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

type CodeSelection = { startLine: number; startColumn: number; endLine: number; endColumn: number; text: string };
type RuntimeCodeEditorProps = { value: string; filePath: string; sha?: string; onChange: (nextValue: string) => void; onSelectionChange?: (selection: CodeSelection | null) => void; highlightRange?: { startLine: number; endLine: number } | null };
type CursorStatus = { line: number; column: number; offset: number };
type Mark = { id: string; kind: string; start: number; end: number; label: string };
type CodeEditorCommand = { action?: string; query?: string; kind?: string };

function lineCount(value: string) { return Math.max(value.split("\n").length, 1); }
function shortSha(value?: string) { return value ? value.slice(0, 7) : "no-sha"; }
function lineNumbers(value: string) { return Array.from({ length: lineCount(value) }, (_, index) => index + 1).join("\n"); }
function positionFromOffset(value: string, offset: number) { const before = value.slice(0, Math.max(0, offset)); const lines = before.split("\n"); return { line: lines.length, column: (lines.at(-1)?.length || 0) + 1, offset }; }
function selectionFromTextarea(textarea: HTMLTextAreaElement): CodeSelection { const value = textarea.value; const start = textarea.selectionStart || 0; const end = textarea.selectionEnd || start; const startPos = positionFromOffset(value, start); const endPos = positionFromOffset(value, end); return { startLine: startPos.line, startColumn: startPos.column, endLine: endPos.line, endColumn: endPos.column, text: value.slice(start, end) }; }
function allMatches(value: string, query: string) { const needle = query.trim().toLowerCase(); if (!needle) return []; const haystack = value.toLowerCase(); const found: Array<{ start: number; end: number }> = []; let index = 0; while (index <= haystack.length) { const next = haystack.indexOf(needle, index); if (next < 0) break; found.push({ start: next, end: next + needle.length }); index = next + Math.max(needle.length, 1); } return found; }

export default function RuntimeCodeEditor({ value, filePath, sha, onChange, onSelectionChange, highlightRange }: RuntimeCodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const gutterRef = useRef<HTMLPreElement | null>(null);
  const [selection, setSelection] = useState<CodeSelection | null>(null);
  const [status, setStatus] = useState("Ready");
  const [cursor, setCursor] = useState<CursorStatus>({ line: 1, column: 1, offset: 0 });
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [findIndex, setFindIndex] = useState(-1);
  const [editMenuOpen, setEditMenuOpen] = useState(true);
  const [marks, setMarks] = useState<Mark[]>([]);
  const numbers = useMemo(() => lineNumbers(value || ""), [value]);
  const matches = useMemo(() => allMatches(value || "", findQuery), [value, findQuery]);

  function publish(message = status) { window.dispatchEvent(new CustomEvent("streams-builder:code-editor-state", { detail: { filePath, sha, status: message, cursor, selection, findQuery, matchCount: matches.length, findIndex, marks: marks.length, lineCount: lineCount(value || ""), charCount: (value || "").length } })); }
  function report(message: string) { setStatus(message); window.dispatchEvent(new CustomEvent("streams-builder:code-editor-result", { detail: { filePath, sha, message } })); window.dispatchEvent(new CustomEvent("streams-builder-summary-event", { detail: { phase: "code-editor", message } })); }
  function syncScroll() { if (gutterRef.current && textareaRef.current) gutterRef.current.scrollTop = textareaRef.current.scrollTop; }
  function updateSelection() { const textarea = textareaRef.current; if (!textarea) return; const next = selectionFromTextarea(textarea); setSelection(next); setCursor(positionFromOffset(textarea.value, textarea.selectionStart || 0)); onSelectionChange?.(next.text ? next : null); window.setTimeout(() => publish(), 0); }
  function scrollToOffset(offset: number) { const textarea = textareaRef.current; if (!textarea) return; const line = positionFromOffset(textarea.value, offset).line; textarea.scrollTop = Math.max(0, (line - 4) * 19); syncScroll(); }
  function selectRange(start: number, end: number, message: string) { const textarea = textareaRef.current; if (!textarea) return; textarea.focus(); textarea.setSelectionRange(start, end); scrollToOffset(start); window.setTimeout(updateSelection, 0); report(message); }
  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) { onChange(event.target.value); window.setTimeout(updateSelection, 0); }
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") { event.preventDefault(); openFind(); } }
  async function copyText(text: string, label: string) { if (!text) { report("Nothing to copy"); return; } try { await navigator.clipboard.writeText(text); report(`${label} copied`); } catch { const textarea = textareaRef.current; textarea?.focus(); document.execCommand("copy"); report(`${label} copied`); } }
  function copyCurrentLine() { const lines = (value || "").split("\n"); void copyText(lines[Math.max(0, cursor.line - 1)] || "", `Line ${cursor.line}`); }
  function copySelection() { const current = textareaRef.current ? selectionFromTextarea(textareaRef.current) : selection; void copyText(current?.text || "", current?.text ? `Lines ${current.startLine}-${current.endLine}` : "Selection"); }
  function copyAll() { void copyText(value || "", "Full file"); }
  function selectAll() { const textarea = textareaRef.current; if (!textarea) return; selectRange(0, textarea.value.length, "All code selected"); }
  function openFind() { setFindOpen(true); setEditMenuOpen(true); report("Find opened"); }
  function clearMarks() { setMarks([]); setFindQuery(""); setFindIndex(-1); setFindOpen(false); report("Marks and search cleared"); }
  function mark(kind: string) { const textarea = textareaRef.current; if (!textarea) return; const start = textarea.selectionStart || 0; const end = textarea.selectionEnd || start; if (start === end) { report(`Select code before ${kind.toLowerCase()}`); return; } const next = selectionFromTextarea(textarea); setMarks((items) => [...items, { id: `${Date.now()}-${kind}`, kind, start, end, label: `Lines ${next.startLine}-${next.endLine}` }]); report(`${kind} marked on lines ${next.startLine}-${next.endLine}`); }
  function goToMatch(nextIndex: number, query = findQuery) { const localMatches = allMatches(value || "", query); if (!localMatches.length) { report(query.trim() ? `No matches for ${query}` : "Enter a search term"); return; } const safeIndex = (nextIndex + localMatches.length) % localMatches.length; const match = localMatches[safeIndex]; setFindQuery(query); setFindIndex(safeIndex); setFindOpen(true); setEditMenuOpen(true); selectRange(match.start, match.end, `Found ${safeIndex + 1} of ${localMatches.length}: ${query}`); }
  function findNext() { goToMatch(findIndex + 1); }
  function findPrev() { goToMatch(findIndex <= 0 ? matches.length - 1 : findIndex - 1); }

  useEffect(() => { publish("Code editor ready"); }, [filePath, sha]);
  useEffect(() => {
    function onCommand(event: Event) {
      const detail = (event as CustomEvent<CodeEditorCommand>).detail || {};
      const action = String(detail.action || "").toLowerCase();
      if (!action) return;
      if (action === "open" || action === "focus") { textareaRef.current?.focus(); report("Code editor focused"); return; }
      if (action === "find" || action === "search") { goToMatch(0, detail.query || findQuery); return; }
      if (action === "next" || action === "find-next") { findNext(); return; }
      if (action === "prev" || action === "previous" || action === "find-prev") { findPrev(); return; }
      if (action === "select-all") { selectAll(); return; }
      if (action === "copy-all") { copyAll(); return; }
      if (action === "copy-line") { copyCurrentLine(); return; }
      if (action === "copy-selection" || action === "copy") { copySelection(); return; }
      if (action === "clear") { clearMarks(); return; }
      if (action === "highlight" || action === "circle" || action === "underline") { mark(detail.kind || action.charAt(0).toUpperCase() + action.slice(1)); return; }
      report(`Unknown code editor command: ${action}`);
    }
    window.addEventListener("streams-builder:code-editor-command", onCommand);
    return () => window.removeEventListener("streams-builder:code-editor-command", onCommand);
  }, [findQuery, findIndex, matches.length, value, cursor.line, selection]);

  return (
    <section className="runtimeCodeEditor" aria-label={`Runtime code editor for ${filePath}`}>
      <header className="codeToolbar"><div className="fileMeta"><b>{filePath || "No file selected"}</b><span>{lineCount(value).toLocaleString()} lines · {(value || "").length.toLocaleString()} chars · {shortSha(sha)}</span></div><div className="iconTools"><button type="button" title="Copy selection" onClick={copySelection}>⧉</button><button type="button" title="Download file" onClick={() => { const blob = new Blob([value || ""], { type: "text/plain;charset=utf-8" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filePath.split("/").pop() || "source.txt"; a.click(); URL.revokeObjectURL(url); }}>⇩</button><button type="button" title="Edit tools" onClick={() => setEditMenuOpen((open) => !open)}>✎</button><button type="button" title="More tools" onClick={() => setEditMenuOpen((open) => !open)}>⌄</button></div></header>
      <div className="utilityBar"><div className="cursorMeta"><span>Ln {cursor.line}, Col {cursor.column}</span><span>{Math.min(cursor.offset, (value || "").length).toLocaleString()} of {(value || "").length.toLocaleString()} characters</span></div><div className="historyMeta"><span>{shortSha(sha)} · current</span><button type="button" onClick={() => report(`History ready for ${shortSha(sha)}`)}>↺ History</button></div></div>
      {editMenuOpen ? <div className="editMenu"><button type="button" onClick={selectAll}>Select all</button><button type="button" onClick={copyAll}>Copy all</button><button type="button" onClick={copyCurrentLine}>Copy line</button><button type="button" onClick={copySelection}>Copy selection</button><button type="button" onClick={openFind}>Find/search</button><button type="button" onClick={() => mark("Highlight")}>Highlight</button><button type="button" onClick={() => mark("Circle")}>Circle</button><button type="button" onClick={() => mark("Underline")}>Underline</button><button type="button" onClick={clearMarks}>Clear marks</button></div> : null}
      {findOpen ? <div className="findBar"><input value={findQuery} onChange={(event) => { setFindQuery(event.target.value); setFindIndex(-1); }} onKeyDown={(event) => { if (event.key === "Enter") findNext(); if (event.key === "Escape") setFindOpen(false); }} placeholder="Find in file" autoFocus /><button type="button" onClick={findPrev}>Prev</button><button type="button" onClick={findNext}>{findIndex < 0 ? "Find" : "Next"}</button><span>{findQuery ? `${matches.length} match${matches.length === 1 ? "" : "es"}` : ""}</span><button type="button" onClick={() => { setFindOpen(false); setFindIndex(-1); }}>×</button></div> : null}
      {marks.length ? <div className="markBar">{marks.map((item) => <button key={item.id} type="button" className={item.kind.toLowerCase()} onClick={() => selectRange(item.start, item.end, `${item.kind} ${item.label}`)}>{item.kind}: {item.label}</button>)}</div> : null}
      <div className="selectionBar"><span>{selection?.text ? `Selected lines ${selection.startLine}-${selection.endLine}, columns ${selection.startColumn}-${selection.endColumn}` : highlightRange ? `Highlighted lines ${highlightRange.startLine}-${highlightRange.endLine}` : "Click in code to select a range"}</span><span>{status}</span></div>
      <div className="editorFrame"><pre ref={gutterRef} className="lineGutter" aria-hidden="true">{numbers}</pre><textarea ref={textareaRef} value={value} onChange={handleChange} onSelect={updateSelection} onKeyUp={updateSelection} onClick={updateSelection} onScroll={syncScroll} onKeyDown={handleKeyDown} spellCheck={false} /></div>
      <style jsx>{`.runtimeCodeEditor{height:100%;min-height:0;display:grid;grid-template-rows:auto auto auto auto auto minmax(0,1fr);background:#0d1117;color:#e6edf3;overflow:hidden;border:1px solid #30363d;border-radius:12px}.codeToolbar{min-width:0;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 10px;background:#f6f8fa;border-bottom:1px solid #d0d7de;color:#24292f}.fileMeta{min-width:0;display:grid;gap:2px}.fileMeta b{min-width:0;color:#24292f;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fileMeta span{color:#57606a;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.iconTools{display:flex;align-items:center;gap:8px}.iconTools button{height:32px;min-width:34px;border:1px solid #d0d7de;border-radius:10px;background:#f6f8fa;color:#57606a;font-size:18px;font-weight:800;cursor:pointer}.utilityBar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:7px 12px;background:#fff;border-bottom:1px solid #d8dee4;color:#57606a;font-size:12px}.cursorMeta,.historyMeta{display:flex;align-items:center;gap:14px;min-width:0}.historyMeta button{border:0;background:transparent;color:#24292f;font-weight:900;cursor:pointer;font-size:13px}.editMenu{display:flex;gap:6px;flex-wrap:wrap;padding:8px 10px;background:#f6f8fa;border-bottom:1px solid #d0d7de}.editMenu button,.findBar button,.markBar button{height:30px;border:1px solid #d0d7de;border-radius:7px;background:#fff;color:#24292f;font-size:11px;font-weight:800;padding:0 9px;cursor:pointer}.findBar{display:grid;grid-template-columns:minmax(160px,1fr) auto auto auto auto;align-items:center;gap:6px;padding:8px 10px;background:#fff8c5;border-bottom:1px solid #d4a72c;color:#24292f;font-size:11px}.findBar input{height:30px;border:1px solid #d0d7de;border-radius:8px;background:#fff;color:#24292f;padding:0 10px;outline:none}.markBar{display:flex;gap:6px;flex-wrap:wrap;padding:6px 10px;background:#101826;border-bottom:1px solid #30363d}.markBar button.highlight{background:#fff8c5}.markBar button.circle{border-radius:999px}.markBar button.underline{text-decoration:underline}.selectionBar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 12px;background:#0d1117;border-bottom:1px solid #30363d;color:#8b949e;font-size:11px}.selectionBar span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.editorFrame{min-width:0;min-height:0;display:grid;grid-template-columns:54px minmax(0,1fr);overflow:hidden;background:#0d1117}.lineGutter{margin:0;padding:10px 8px 40px 0;background:#0d1117;border-right:1px solid #30363d;color:#6e7681;text-align:right;font:12px/19px ui-monospace,SFMono-Regular,Consolas,Liberation Mono,Menlo,monospace;overflow:hidden;user-select:none}.editorFrame textarea{width:100%;height:100%;min-width:0;min-height:0;resize:none;border:0;outline:0;background:#0d1117;color:#e6edf3;padding:10px 12px 40px;font:12px/19px ui-monospace,SFMono-Regular,Consolas,Liberation Mono,Menlo,monospace;white-space:pre;overflow:auto;tab-size:2;box-sizing:border-box}.editorFrame textarea::selection{background:rgba(250,204,21,.65);color:#fff}`}</style>
    </section>
  );
}
