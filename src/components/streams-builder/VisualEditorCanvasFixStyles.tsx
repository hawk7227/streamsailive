"use client";

export default function VisualEditorCanvasFixStyles() {
  return <style jsx global>{`
    .visualEditor { height: 100% !important; min-height: 0 !important; overflow: hidden !important; }
    .visualEditor .canvas { height: 100% !important; min-height: 0 !important; overflow: hidden !important; }
    .visualEditor .canvas.editor .desktopFrame,
    .visualEditor .canvas.browser .desktopFrame,
    .visualEditor .canvas.advanced .desktopFrame { position: relative !important; width: auto !important; height: calc(100% - 18px) !important; margin: 10px !important; overflow: auto !important; background: #fff !important; }
    .visualEditor .desktopFrame iframe,
    .visualEditor .phoneFrame iframe { display: block !important; width: 100% !important; min-width: 100% !important; height: 2200px !important; border: 0 !important; background: #fff !important; }
  `}</style>;
}
