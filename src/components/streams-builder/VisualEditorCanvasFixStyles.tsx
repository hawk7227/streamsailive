"use client";

export default function VisualEditorCanvasFixStyles() {
  return <style jsx global>{`
    .visualEditor { height: 100% !important; min-height: 0 !important; overflow: hidden !important; }
    .visualEditor .canvas { height: 100% !important; min-height: 0 !important; overflow: hidden !important; }
    .visualEditor .editor .desktopFrame,
    .visualEditor .browser .desktopFrame,
    .visualEditor .advanced .desktopFrame { position: absolute !important; inset: 10px !important; width: auto !important; height: auto !important; margin: 0 !important; overflow: auto !important; background: #fff !important; }
    .visualEditor .splitMode { display: grid !important; grid-template-columns: minmax(520px, 1fr) minmax(520px, 1fr) !important; gap: 10px !important; padding: 10px !important; box-sizing: border-box !important; overflow: hidden !important; }
    .visualEditor .splitMode .codePanel,
    .visualEditor .splitMode .splitPreview { min-width: 0 !important; min-height: 0 !important; height: 100% !important; display: grid !important; overflow: hidden !important; }
    .visualEditor .splitMode .splitPreview { grid-template-rows: auto minmax(0, 1fr) !important; }
    .visualEditor .splitMode .desktopFrame.embedded { position: relative !important; inset: auto !important; width: 100% !important; height: 100% !important; margin: 0 !important; overflow: auto !important; background: #fff !important; }
    .visualEditor .desktopFrame iframe,
    .visualEditor .phoneFrame iframe { display: block !important; width: 100% !important; min-width: 100% !important; height: 2200px !important; border: 0 !important; background: #fff !important; }
  `}</style>;
}
