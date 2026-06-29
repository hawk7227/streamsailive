"use client";

export default function VisualEditorCanvasFixStyles() {
  return <style jsx global>{`
    .visualEditor {
      height: 100% !important;
      min-height: 0 !important;
      overflow: hidden !important;
    }

    .visualEditor .canvas {
      position: relative !important;
      height: 100% !important;
      min-height: 0 !important;
      overflow: hidden !important;
    }

    .visualEditor .desktopFrame {
      position: absolute !important;
      inset: 10px !important;
      width: auto !important;
      height: auto !important;
      margin: 0 !important;
      overflow: auto !important;
      background: #fff !important;
    }

    .visualEditor .desktopFrame iframe {
      display: block !important;
      width: 100% !important;
      min-width: 100% !important;
      height: 2200px !important;
      border: 0 !important;
      background: #fff !important;
    }
  `}</style>;
}
