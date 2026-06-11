"use client";

export default function BeforeAfterReviewPanel() {
  return (
    <section aria-label="Before After Review" className="beforeAfterReviewPanel">
      <button type="button">Before / After Review</button>
      <style jsx>{`
        .beforeAfterReviewPanel { position: fixed; right: 14px; bottom: 14px; z-index: 70; }
        button { border: 1px solid rgba(139, 92, 246, .55); border-radius: 999px; background: #030712; color: #fff; padding: 10px 14px; font-size: 12px; font-weight: 900; }
      `}</style>
    </section>
  );
}
