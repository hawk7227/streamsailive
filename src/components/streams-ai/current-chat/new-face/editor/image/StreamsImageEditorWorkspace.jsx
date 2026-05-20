import { useState } from "react";
import { buildImageEditorState } from "../../../runtime/streamsImageEditorActions";
import ImageCanvas from "./ImageCanvas";
import ImageInspectorPanel from "./ImageInspectorPanel";
import ImageLayerPanel from "./ImageLayerPanel";
import ImageVersionStrip from "./ImageVersionStrip";

export default function StreamsImageEditorWorkspace({ asset, onAction }) {
  const initialState = buildImageEditorState(asset);
  const [selectedLayerId, setSelectedLayerId] = useState(initialState.selectedLayerId);
  const [selectedActionId, setSelectedActionId] = useState("");
  const [selectedVersionId, setSelectedVersionId] = useState("current");

  function selectAction(actionId) {
    setSelectedActionId(actionId);
    onAction?.(actionId, { asset, selectedLayerId });
  }

  return (
    <section aria-label="Full image editor workspace">
      <header aria-label="Image editor command bar">
        <strong>{asset?.name || "Image Editor"}</strong>
        <span>Compare: current</span>
        <span>Saved state: local</span>
      </header>

      <div aria-label="Image editor workspace body">
        <ImageLayerPanel
          asset={asset}
          selectedLayerId={selectedLayerId}
          onSelectLayer={setSelectedLayerId}
        />

        <ImageCanvas asset={asset} zoom={initialState.zoom} compareMode={initialState.compareMode} />

        <ImageInspectorPanel
          selectedLayerId={selectedLayerId}
          selectedActionId={selectedActionId}
          onSelectAction={selectAction}
        />
      </div>

      <ImageVersionStrip
        versions={asset?.versions || []}
        selectedVersionId={selectedVersionId}
        onSelectVersion={setSelectedVersionId}
      />
    </section>
  );
}
