"use client";

export default function VisualEditorSplitFixStyles() {
  return <style jsx global>{`
    .visualEditor .splitMode {
      display: grid !important;
      grid-template-columns: minmax(520px, 1fr) minmax(520px, 1fr) !important;
      gap: 10px !important;
      padding: 10px !important;
      box-sizing: border-box !important;
      overflow: hidden !important;
      align-items: stretch !important;
    }

    .visualEditor .splitMode .codePanel {
      position: relative !important;
      z-index: 20 !important;
      display: grid !important;
      min-width: 0 !important;
      min-height: 0 !important;
      height: 100% !important;
      overflow: hidden !important;
      background: #020617 !important;
    }

    .visualEditor .splitMode .splitPreview {
      position: relative !important;
      z-index: 1 !important;
      display: grid !important;
      grid-template-rows: auto minmax(0, 1fr) !important;
      min-width: 0 !important;
      min-height: 0 !important;
      height: 100% !important;
      overflow: hidden !important;
      background: #020617 !important;
    }

    .visualEditor .splitMode .desktopFrame.embedded {
      position: relative !important;
      inset: auto !important;
      width: 100% !important;
      height: 100% !important;
      min-height: 0 !important;
      margin: 0 !important;
      overflow: auto !important;
      background: #fff !important;
    }
  `}</style>;
}
