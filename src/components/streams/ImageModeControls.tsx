'use client';

/**
 * Phase 5: Image Mode Type-Specific Features
 * - Batch generation (generate 3, 5, 10 variations)
 * - Style selector (photo-realistic, artistic, illustration, 3D, anime)
 * - Quality slider (draft → production)
 */

import React, { useState } from 'react';
import { C, R } from './tokens';

export interface ImageModeConfig {
  batchSize: 1 | 3 | 5 | 10;
  style: 'realistic' | 'artistic' | 'illustration' | '3d' | 'anime';
  quality: 'draft' | 'standard' | 'production';
  aspectRatio: '1:1' | '16:9' | '9:16' | '4:3';
}

export interface ImageModeControlsProps {
  onConfigChange?: (config: ImageModeConfig) => void;
  defaultConfig?: ImageModeConfig;
}

const STYLE_LABELS: Record<string, string> = {
  realistic: '📷 Photo-Realistic',
  artistic: '🎨 Artistic',
  illustration: '✏️ Illustration',
  '3d': '🎭 3D Render',
  anime: '✨ Anime',
};

const QUALITY_LABELS: Record<string, string> = {
  draft: 'Draft (Fast)',
  standard: 'Standard',
  production: 'Production (Best)',
};

export function ImageModeControls({
  onConfigChange,
  defaultConfig = {
    batchSize: 3,
    style: 'realistic',
    quality: 'standard',
    aspectRatio: '1:1',
  },
}: ImageModeControlsProps) {
  const [config, setConfig] = useState<ImageModeConfig>(defaultConfig);

  const handleChange = (newConfig: Partial<ImageModeConfig>) => {
    const updated = { ...config, ...newConfig };
    setConfig(updated);
    onConfigChange?.(updated);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Batch size */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: C.t1 }}>
          Generate variations ({config.batchSize} image{config.batchSize > 1 ? 's' : ''})
        </label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[1, 3, 5, 10].map((size) => (
            <button
              key={size}
              onClick={() => handleChange({ batchSize: size as 1 | 3 | 5 | 10 })}
              style={{
                padding: '8px 12px',
                borderRadius: R.r1,
                border: `1px solid ${config.batchSize === size ? C.acc : C.bdr}`,
                background: config.batchSize === size ? C.acc : 'transparent',
                color: config.batchSize === size ? '#fff' : C.t2,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
                transition: 'transform 150ms ease, opacity 150ms ease',
              }}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* Style selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: C.t1 }}>Style</label>
        <div style={{ display: 'flex', gap: 6, flexDirection: 'column' }}>
          {Object.entries(STYLE_LABELS).map(([value, label]) => (
            <button
              key={value}
              onClick={() => handleChange({ style: value as any })}
              style={{
                padding: '8px 12px',
                borderRadius: R.r1,
                border: `1px solid ${config.style === value ? C.acc : C.bdr}`,
                background: config.style === value ? 'rgba(124,58,237,0.1)' : 'transparent',
                color: config.style === value ? C.acc : C.t2,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: config.style === value ? 500 : 400,
                textAlign: 'left',
                transition: 'transform 150ms ease, opacity 150ms ease',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Quality slider */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: C.t1 }}>
          Quality: {QUALITY_LABELS[config.quality]}
        </label>
        <div style={{ display: 'flex', gap: 6 }}>
          {Object.keys(QUALITY_LABELS).map((quality) => (
            <button
              key={quality}
              onClick={() => handleChange({ quality: quality as any })}
              style={{
                flex: 1,
                padding: '8px 8px',
                borderRadius: R.r1,
                border: `1px solid ${config.quality === quality ? C.acc : C.bdr}`,
                background: config.quality === quality ? C.acc : 'transparent',
                color: config.quality === quality ? '#fff' : C.t2,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
                transition: 'transform 150ms ease, opacity 150ms ease',
              }}
            >
              {quality === 'draft' ? 'Draft' : quality === 'standard' ? 'Std' : 'Pro'}
            </button>
          ))}
        </div>
      </div>

      {/* Aspect ratio */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: C.t1 }}>Aspect Ratio</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['1:1', '16:9', '9:16', '4:3'].map((ratio) => (
            <button
              key={ratio}
              onClick={() => handleChange({ aspectRatio: ratio as any })}
              style={{
                padding: '8px 12px',
                borderRadius: R.r1,
                border: `1px solid ${config.aspectRatio === ratio ? C.acc : C.bdr}`,
                background: config.aspectRatio === ratio ? C.acc : 'transparent',
                color: config.aspectRatio === ratio ? '#fff' : C.t2,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
                transition: 'transform 150ms ease, opacity 150ms ease',
              }}
            >
              {ratio}
            </button>
          ))}
        </div>
      </div>

      {/* Info */}
      <div style={{ fontSize: 12, color: C.t4, marginTop: 4 }}>
        Generating {config.batchSize} {config.style} image{config.batchSize > 1 ? 's' : ''} at {config.quality} quality ({config.aspectRatio})
      </div>
    </div>
  );
}
