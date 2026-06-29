"use client";

export default function PreviewCanvasFixStyles() {
  return <style jsx global>{`
    .liveWorkstation .previewSide {
      display: flex !important;
      flex-direction: column !important;
      height: 100% !important;
      min-height: 0 !important;
    }

    .liveWorkstation .tabs,
    .liveWorkstation .debug,
    .liveWorkstation .toolStrip,
    .liveWorkstation .toolDrawer {
      flex: 0 0 auto !important;
    }

    .liveWorkstation .content.full {
      flex: 1 1 auto !important;
      display: block !important;
      position: relative !important;
      height: auto !important;
      min-height: 0 !important;
      overflow: hidden !important;
      background: #020617 !important;
    }

    .liveWorkstation .content.full > .frameWrap {
      position: absolute !important;
      inset: 0 !important;
      width: 100% !important;
      height: 100% !important;
      margin: 0 !important;
      max-width: none !important;
      border-radius: 0 !important;
      overflow: auto !important;
      background: #fff !important;
    }

    .liveWorkstation .content.full > .frameWrap iframe {
      display: block !important;
      width: 100% !important;
      min-width: 100% !important;
      height: 2200px !important;
      min-height: 100% !important;
      border: 0 !important;
      background: #fff !important;
    }
  `}</style>;
}
