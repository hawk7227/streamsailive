export default function LiquidConsoleGraphics({ state = "idle" }) {
  return (
    <div className="streamsComposerLiquidLayer" aria-hidden="true" data-liquid-state={state}>
      <svg className="streamsComposerLiquidSvg" viewBox="0 0 1200 220" preserveAspectRatio="none" focusable="false">
        <defs>
          <radialGradient id="streamsComposerCoreGlow" cx="52%" cy="52%" r="42%">
            <stop offset="0%" stopColor="#06D9FF" stopOpacity="0.86" />
            <stop offset="32%" stopColor="#2563EB" stopOpacity="0.48" />
            <stop offset="72%" stopColor="#7C3AED" stopOpacity="0.30" />
            <stop offset="100%" stopColor="#D946EF" stopOpacity="0" />
          </radialGradient>

          <linearGradient id="streamsComposerWaveGradientA" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#D946EF" stopOpacity="0.18" />
            <stop offset="34%" stopColor="#7C3AED" stopOpacity="0.44" />
            <stop offset="62%" stopColor="#2563EB" stopOpacity="0.38" />
            <stop offset="100%" stopColor="#D946EF" stopOpacity="0.28" />
          </linearGradient>

          <linearGradient id="streamsComposerWaveGradientB" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#2563EB" stopOpacity="0" />
            <stop offset="46%" stopColor="#06D9FF" stopOpacity="0.22" />
            <stop offset="78%" stopColor="#D946EF" stopOpacity="0.30" />
            <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
          </linearGradient>

          <filter id="streamsComposerSoftBlur" x="-20%" y="-40%" width="140%" height="180%">
            <feGaussianBlur stdDeviation="18" />
          </filter>
        </defs>

        <g className="streamsLiquidWave streamsLiquidWaveOne" filter="url(#streamsComposerSoftBlur)">
          <path d="M-80 148 C 92 52 192 196 342 116 C 512 26 628 172 782 98 C 944 20 1038 146 1280 54 L1280 238 L-80 238 Z" fill="url(#streamsComposerWaveGradientA)" />
        </g>

        <g className="streamsLiquidWave streamsLiquidWaveTwo" filter="url(#streamsComposerSoftBlur)">
          <path d="M-120 86 C 72 184 194 34 356 104 C 524 176 624 72 792 126 C 980 188 1084 40 1320 112 L1320 238 L-120 238 Z" fill="url(#streamsComposerWaveGradientB)" />
        </g>

        <ellipse className="streamsLiquidCore" cx="612" cy="112" rx="214" ry="82" fill="url(#streamsComposerCoreGlow)" filter="url(#streamsComposerSoftBlur)" />
      </svg>

      <span className="streamsComposerReadabilityVeil" />
      <span className="streamsComposerTrimStreak" />
    </div>
  );
}
