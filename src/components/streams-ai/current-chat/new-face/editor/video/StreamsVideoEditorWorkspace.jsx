import { useState } from "react";
import {
  buildVideoEditorSelection,
  buildVideoEditorState,
} from "../../../runtime/streamsVideoEditorActions";
import VideoInspectorPanel from "./VideoInspectorPanel";
import VideoIntelligencePanel from "./VideoIntelligencePanel";
import VideoPreviewCanvas from "./VideoPreviewCanvas";
import VideoTimeline from "./VideoTimeline";

export default function StreamsVideoEditorWorkspace({ asset, onAction }) {
  const initialState = buildVideoEditorState(asset);
  const [selectedRange, setSelectedRange] = useState(initialState.selectedRange);
  const [selectedActionId, setSelectedActionId] = useState("");

  function selectRange(range) {
    setSelectedRange(buildVideoEditorSelection(range));
  }

  function selectAction(actionId) {
    setSelectedActionId(actionId);
    onAction?.(actionId, { asset, selectedRange });
  }

  return (
    <section aria-label="Full video editor workspace">
      <header aria-label="Video editor command bar">
        <strong>{asset?.name || "Video Editor"}</strong>
        <span>Compare: current</span>
        <span>Saved state: local</span>
      </header>

      <div aria-label="Video editor workspace body">
        <VideoIntelligencePanel
          asset={asset}
          selectedRange={selectedRange}
          onSelectRange={selectRange}
        />

        <VideoPreviewCanvas
          asset={asset}
          selectedRange={selectedRange}
          compareMode={initialState.compareMode}
        />

        <VideoInspectorPanel
          selectedRange={selectedRange}
          selectedActionId={selectedActionId}
          onSelectAction={selectAction}
        />
      </div>

      <VideoTimeline
        selectedRange={selectedRange}
        onSelectLane={(lane) => {
          setSelectedRange((current) => ({ ...current, trackType: lane }));
        }}
      />
    </section>
  );
}
