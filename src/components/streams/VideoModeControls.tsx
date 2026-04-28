'use client';

/**
 * Phase 5: Video Mode Type-Specific Features
 * - Aspect ratio selector (16:9, 9:16, 1:1, 21:9)
 * - Motion intensity (subtle → intense)
 * - Frame rate selector (24fps, 30fps, 60fps)
 * - Duration control (15s, 30s, 60s)
 */

import React, { useState } from 'react';
import { C, R } from './tokens';

export interface VideoModeConfig {
  aspectRatio: '16:9' | '9:16' | '1:1' | '21:9';
  motionIntensity: 'subtle' | 'moderate' | 'intense' | 'dynamic';
  fps: 24 | 30 | 60;
  duration: 15 | 30 | 60;
}

export interface VideoModeControlsProps {
  onConfigChange?: (config: VideoModeConfig) => void;
  defaultConfig?: VideoModeConfig;
}

const MOTION_DESCRIPTIONS: Record<string, string> = {
  subtle: 'Slow, gentle movement',
  moderate: 'Balanced pacing',
  intense: 'Fast, energetic motion',
  dynamic: 'Highly dynamic, cuts & transitions',
};

export function VideoModeControls({
  onConfigChange,
  defaultConfig = {
    aspectRatio: '16:9',
    motionIntensity: 'moderate',
    fps: 30,
    duration: 30,
  },
}: VideoModeControlsProps) {
  const [config, setConfig] = useState<VideoModeConfig>(defaultConfig);

  const handleChange = (newConfig: Partial<VideoModeConfig>) => {
    const updated = { ...config, ...newConfig };
    setConfig(updated);
    onConfigChange?.(updated);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Aspect ratio */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: C.t1 }}>Aspect Ratio</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['16:9', '9:16', '1:1', '21:9'].map((ratio) => (
            <button
              key={ratio}
              onClick={() => handleChange({ aspectRatio: ratio as any })}
              style={{
                padding: '6px 12px',
                borderRadius: R.r1,
                border: `1px solid ${config.aspectRatio === ratio ? C.acc : C.bdr}`,
                background: config.aspectRatio === ratio ? C.acc : 'transparent',
                color: config.aspectRatio === ratio ? '#fff' : C.t2,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
                transition: 'all 150ms ease',
              }}
            >
              {ratio}
            </button>
          ))}
        </div>
      </div>

      {/* Motion intensity */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: C.t1 }}>Motion Intensity</label>
        <div style={{ display: 'flex', gap: 6, flexDirection: 'column' }}>
          {Object.entries(MOTION_DESCRIPTIONS).map(([value, description]) => (
            <button
              key={value}
              onClick={() => handleChange({ motionIntensity: value as any })}
              style={{
                padding: '8px 12px',
                borderRadius: R.r1,
                border: `1px solid ${config.motionIntensity === value ? C.acc : C.bdr}`,
                background: config.motionIntensity === value ? 'rgba(124,58,237,0.1)' : 'transparent',
                color: config.motionIntensity === value ? C.acc : C.t2,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: config.motionIntensity === value ? 500 : 400,
                textAlign: 'left',
                transition: 'all 150ms ease',
              }}
            >
              <div style={{ textTransform: 'capitalize', marginBottom: 2 }}>{value}</div>
              <div style={{ fontSize: 11, color: C.t4 }}>{description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Frame rate */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: C.t1 }}>Frame Rate</label>
        <div style={{ display: 'flex', gap: 6 }}>
          {[24, 30, 60].map((fps) => (
            <button
              key={fps}
              onClick={() => handleChange({ fps: fps as any })}
              style={{
                flex: 1,
                padding: '6px 8px',
                borderRadius: R.r1,
                border: `1px solid ${config.fps === fps ? C.acc : C.bdr}`,
                background: config.fps === fps ? C.acc : 'transparent',
                color: config.fps === fps ? '#fff' : C.t2,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
                transition: 'all 150ms ease',
              }}
            >
              {fps}fps
            </button>
          ))}
        </div>
      </div>

      {/* Duration */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: C.t1 }}>Duration</label>
        <div style={{ display: 'flex', gap: 6 }}>
          {[15, 30, 60].map((duration) => (
            <button
              key={duration}
              onClick={() => handleChange({ duration: duration as any })}
              style={{
                flex: 1,
                padding: '6px 8px',
                borderRadius: R.r1,
                border: `1px solid ${config.duration === duration ? C.acc : C.bdr}`,
                background: config.duration === duration ? C.acc : 'transparent',
                color: config.duration === duration ? '#fff' : C.t2,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
                transition: 'all 150ms ease',
              }}
            >
              {duration}s
            </button>
          ))}
        </div>
      </div>

      {/* Info */}
      <div style={{ fontSize: 11, color: C.t4, marginTop: 4 }}>
        {config.aspectRatio} • {config.motionIntensity} • {config.fps}fps • {config.duration}s
      </div>
    </div>
  );
}
