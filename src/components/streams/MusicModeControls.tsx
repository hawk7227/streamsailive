'use client';

/**
 * Phase 5: Music Mode Type-Specific Features
 * - BPM control (60-180 BPM)
 * - Mood selector (energetic, calm, uplifting, dark, mysterious)
 * - Instrument/genre hints
 * - Duration control (30s, 60s, 120s)
 */

import React, { useState } from 'react';
import { C, R } from './tokens';

export interface MusicModeConfig {
  bpm: number; // 60-180
  mood: 'energetic' | 'calm' | 'uplifting' | 'dark' | 'mysterious';
  duration: 30 | 60 | 120;
}

export interface MusicModeControlsProps {
  onConfigChange?: (config: MusicModeConfig) => void;
  defaultConfig?: MusicModeConfig;
}

const MOOD_DESCRIPTIONS: Record<string, { emoji: string; description: string }> = {
  energetic: { emoji: '⚡', description: 'Fast-paced, high energy' },
  calm: { emoji: '🌊', description: 'Relaxing, peaceful' },
  uplifting: { emoji: '☀️', description: 'Positive, inspiring' },
  dark: { emoji: '🌙', description: 'Intense, dramatic' },
  mysterious: { emoji: '🔮', description: 'Ambient, introspective' },
};

const BPM_LABELS: Record<number, string> = {
  60: 'Slow',
  90: 'Moderate',
  120: 'Fast',
  150: 'Very Fast',
  180: 'Extreme',
};

export function MusicModeControls({
  onConfigChange,
  defaultConfig = {
    bpm: 120,
    mood: 'uplifting',
    duration: 60,
  },
}: MusicModeControlsProps) {
  const [config, setConfig] = useState<MusicModeConfig>(defaultConfig);

  const handleChange = (newConfig: Partial<MusicModeConfig>) => {
    const updated = { ...config, ...newConfig };
    setConfig(updated);
    onConfigChange?.(updated);
  };

  const getBPMLabel = (bpm: number): string => {
    if (bpm <= 70) return 'Slow';
    if (bpm <= 100) return 'Moderate';
    if (bpm <= 130) return 'Fast';
    if (bpm <= 160) return 'Very Fast';
    return 'Extreme';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* BPM slider */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: C.t1 }}>
          BPM: {config.bpm} ({getBPMLabel(config.bpm)})
        </label>
        <input
          type="range"
          min="60"
          max="180"
          value={config.bpm}
          onChange={(e) => handleChange({ bpm: parseInt(e.target.value) })}
          style={{
            width: '100%',
            cursor: 'pointer',
            accentColor: C.acc,
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.t4 }}>
          <span>60</span>
          <span>120</span>
          <span>180</span>
        </div>
      </div>

      {/* Mood selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: C.t1 }}>Mood</label>
        <div style={{ display: 'flex', gap: 6, flexDirection: 'column' }}>
          {Object.entries(MOOD_DESCRIPTIONS).map(([value, { emoji, description }]) => (
            <button
              key={value}
              onClick={() => handleChange({ mood: value as any })}
              style={{
                padding: '8px 12px',
                borderRadius: R.r1,
                border: `1px solid ${config.mood === value ? C.acc : C.bdr}`,
                background: config.mood === value ? 'rgba(124,58,237,0.1)' : 'transparent',
                color: config.mood === value ? C.acc : C.t2,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: config.mood === value ? 500 : 400,
                textAlign: 'left',
                transition: 'transform 150ms ease, opacity 150ms ease',
              }}
            >
              <div style={{ marginBottom: 2 }}>
                {emoji} {value.charAt(0).toUpperCase() + value.slice(1)}
              </div>
              <div style={{ fontSize: 12, color: C.t4 }}>{description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Duration */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: C.t1 }}>Duration</label>
        <div style={{ display: 'flex', gap: 6 }}>
          {[30, 60, 120].map((duration) => (
            <button
              key={duration}
              onClick={() => handleChange({ duration: duration as any })}
              style={{
                flex: 1,
                padding: '8px 8px',
                borderRadius: R.r1,
                border: `1px solid ${config.duration === duration ? C.acc : C.bdr}`,
                background: config.duration === duration ? C.acc : 'transparent',
                color: config.duration === duration ? '#fff' : C.t2,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
                transition: 'transform 150ms ease, opacity 150ms ease',
              }}
            >
              {duration === 30 ? '30s' : duration === 60 ? '1m' : '2m'}
            </button>
          ))}
        </div>
      </div>

      {/* Preview button */}
      <button
        style={{
          padding: '8px 12px',
          borderRadius: R.r1,
          border: `1px solid ${C.acc}`,
          background: 'transparent',
          color: C.acc,
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 500,
          transition: 'transform 150ms ease, opacity 150ms ease',
        }}
        onMouseOver={(e) => {
          (e.target as HTMLButtonElement).style.background = C.acc;
          (e.target as HTMLButtonElement).style.color = '#fff';
        }}
        onMouseOut={(e) => {
          (e.target as HTMLButtonElement).style.background = 'transparent';
          (e.target as HTMLButtonElement).style.color = C.acc;
        }}
      >
        🎵 Preview Music
      </button>

      {/* Info */}
      <div style={{ fontSize: 12, color: C.t4, marginTop: 4 }}>
        {config.bpm} BPM • {config.mood} • {config.duration}s
      </div>
    </div>
  );
}
