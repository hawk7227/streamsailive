"use client";

export default function VisualEditorScrollBehavior() {
  return (
    <style jsx global>{`
      .visualEditor .canvas.editor,
      .visualEditor .canvas.browser {
        overflow: auto !important;
        scrollbar-width: thin;
        scrollbar-color: #334155 rgba(2, 6, 23, 0.28);
      }

      .visualEditor .canvas.editor::-webkit-scrollbar,
      .visualEditor .canvas.browser::-webkit-scrollbar {
        width: 6px;
        height: 6px;
      }

      .visualEditor .canvas.editor::-webkit-scrollbar-track,
      .visualEditor .canvas.browser::-webkit-scrollbar-track {
        background: rgba(2, 6, 23, 0.28);
      }

      .visualEditor .canvas.editor::-webkit-scrollbar-thumb,
      .visualEditor .canvas.browser::-webkit-scrollbar-thumb {
        background: #334155;
        border-radius: 999px;
      }
    `}</style>
  );
}
