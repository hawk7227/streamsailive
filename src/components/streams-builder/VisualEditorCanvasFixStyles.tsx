"use client";

export default function VisualEditorCanvasFixStyles() {
  return <style jsx global>{`
    .visualEditor .canvas.editor { position: relative !important; overflow: hidden !important; }
    .visualEditor .canvas.browser { position: relative !important; overflow: hidden !important; }
    .visualEditor .canvas.advanced { position: relative !important; overflow: hidden !important; }
    .visualEditor .canvas.editor .desktopFrame { position: absolute !important; inset: 10px !important; width: auto !important; height: auto !important; margin: 0 !important; overflow: auto !important; background: #fff !important; }
    .visualEditor .canvas.browser .desktopFrame { position: absolute !important; inset: 10px !important; width: auto !important; height: auto !important; margin: 0 !important; overflow: auto !important; background: #fff !important; }
    .visualEditor .canvas.advanced .desktopFrame { position: absolute !important; inset: 10px !important; width: auto !important; height: auto !important; margin: 0 !important; overflow: auto !important; background: #fff !important; }
    .visualEditor .canvas.editor .desktopFrame iframe { width: 100% !important; min-width: 100% !important; height: 2200px !important; }
    .visualEditor .canvas.browser .desktopFrame iframe { width: 100% !important; min-width: 100% !important; height: 2200px !important; }
    .visualEditor .canvas.advanced .desktopFrame iframe { width: 100% !important; min-width: 100% !important; height: 2200px !important; }
  `}</style>;
}
