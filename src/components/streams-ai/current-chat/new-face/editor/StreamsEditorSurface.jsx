import DocumentEditorPanel from "./DocumentEditorPanel";
import StreamsImageEditorWorkspace from "./image/StreamsImageEditorWorkspace";
import StreamsVideoEditorWorkspace from "./video/StreamsVideoEditorWorkspace";

export default function StreamsEditorSurface({
  asset,
  onAnalyze,
  onEdit,
  onAnimate,
  onDownload,
  onExtractFrame,
  onRegenerateFromFrame,
  onViewTranscript,
  onViewScenes,
  onAction,
}) {
  if (!asset) return null;

  if (asset.kind === "image") {
    return (
      <StreamsImageEditorWorkspace
        asset={asset}
        onAction={(actionId, context) => {
          if (actionId === "image_analyze" || actionId === "image_micro_analyze") onAnalyze?.(context);
          if (actionId === "image_edit_prompt") onEdit?.(context);
          if (actionId === "image_to_video") onAnimate?.(context);
          onAction?.(actionId, context);
        }}
      />
    );
  }

  if (asset.kind === "video") {
    return (
      <StreamsVideoEditorWorkspace
        asset={asset}
        onAction={(actionId, context) => {
          if (actionId === "video_extract_frame") onExtractFrame?.(context);
          if (actionId === "video_regenerate_shot") onRegenerateFromFrame?.(context);
          if (actionId === "video_transcribe") onViewTranscript?.(context);
          if (actionId === "video_ingest") onViewScenes?.(context);
          onAction?.(actionId, context);
        }}
      />
    );
  }

  return <DocumentEditorPanel asset={asset} onDownload={onDownload} />;
}
