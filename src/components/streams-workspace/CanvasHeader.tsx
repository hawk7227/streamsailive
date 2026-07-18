"use client";

import { BUILDER_CANVAS_MODES } from "./preservation-contract";
import { useProjectWorkspace } from "./ProjectWorkspaceController";

export default function CanvasHeader() {
  const { state, toggleFullscreenCanvas } = useProjectWorkspace();
  return (
    <header className="canvasHeader">
      <div><strong>Streams Builder Workspace</strong><span>Existing builder mounted intact</span></div>
      <div className="canvasTools">
        <select aria-label="Workspace view" defaultValue={BUILDER_CANVAS_MODES[0]}>
          {BUILDER_CANVAS_MODES.map((mode) => <option key={mode}>{mode}</option>)}
        </select>
        <button type="button">Device preview</button>
        <button type="button">Zoom</button>
        <button type="button">Undo</button>
        <button type="button">Redo</button>
        <button type="button">Compare versions</button>
        <button type="button" onClick={toggleFullscreenCanvas}>{state.fullscreenCanvas ? "Exit full screen" : "Full screen"}</button>
      </div>
    </header>
  );
}
