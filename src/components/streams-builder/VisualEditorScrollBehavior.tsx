"use client";

export default function VisualEditorScrollBehavior() {
  return (
    <style jsx global>{`
      .visualEditor .canvas {
        overflow: auto !important;
        scrollbar-width: thin;
        scrollbar-color: #334155 rgba(2, 6, 23, 0.28);
      }

      .visualEditor .canvas::-webkit-scrollbar,
      .visualEditor .editorDrawer::-webkit-scrollbar,
      .visualEditor .proofBox::-webkit-scrollbar,
      .visualEditor .patchBox::-webkit-scrollbar {
        width: 6px;
        height: 6px;
      }

      .visualEditor .canvas::-webkit-scrollbar-track,
      .visualEditor .editorDrawer::-webkit-scrollbar-track,
      .visualEditor .proofBox::-webkit-scrollbar-track,
      .visualEditor .patchBox::-webkit-scrollbar-track {
        background: rgba(2, 6, 23, 0.28);
      }

      .visualEditor .canvas::-webkit-scrollbar-thumb,
      .visualEditor .editorDrawer::-webkit-scrollbar-thumb,
      .visualEditor .proofBox::-webkit-scrollbar-thumb,
      .visualEditor .patchBox::-webkit-scrollbar-thumb {
        background: #334155;
        border-radius: 999px;
      }

      .visualEditor .canvas.browser,
      .visualEditor .canvas.mobile {
        overflow: auto !important;
      }

      .visualEditor .desktopFrame {
        width: 100% !important;
        min-width: 0 !important;
        height: 6000px !important;
        min-height: 6000px !important;
      }

      .visualEditor .desktopFrame iframe {
        width: 100% !important;
        height: 6000px !important;
        min-height: 6000px !important;
      }

      .visualEditor .phoneFrame {
        height: 1200px !important;
        min-height: 1200px !important;
        overflow: auto !important;
      }

      .visualEditor .phoneFrame iframe {
        height: 1600px !important;
        min-height: 1600px !important;
      }

      .visualEditor .frontView {
        min-height: 900px !important;
        overflow: auto !important;
      }

      .visualEditor .editorDrawer[open],
      .visualEditor .proofBox,
      .visualEditor .patchBox {
        overflow: auto !important;
        scrollbar-width: thin;
        scrollbar-color: #334155 rgba(2, 6, 23, 0.28);
      }
    `}</style>
  );
}
