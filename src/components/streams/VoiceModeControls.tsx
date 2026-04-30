'use client';

/**
 * Phase 5: Voice Mode Type-Specific Features
 * - Stability slider (variable → consistent)
 * - Accent/voice selector (American, British, Australian, etc)
 * - Pitch control (male → female)
 * - Speed control (slower → faster)
 */

import React, { useState } from 'react';
import { C, R } from './tokens';

export interface VoiceModeConfig {
  stability: number; // 0-100
  accent: 'american' | 'british' | 'australian' | 'indian' | 'canadian';
  pitch: number; // 0-100
  speed: number; // 0-100
}

export interface VoiceModeControlsProps {
  onConfigChange?: (config: VoiceModeConfig) => void;
  defaultConfig?: VoiceModeConfig;
}

const ACCENT_LABELS: Record<string, string> = {
  american: '🇺🇸 American',
  british: '🇬🇧 British',
  australian: '🇦🇺 Australian',
  indian: '🇮🇳 Indian',
  canadian: '🇨🇦 Canadian',
};

export function VoiceModeControls({
  onConfigChange,
  defaultConfig = {
    stability: 50,
    accent: 'american',
    pitch: 50,
    speed: 50,
  },
}: VoiceModeControlsProps) {
  const [config, setConfig] = useState<VoiceModeConfig>(defaultConfig);

  const handleChange = (newConfig: Partial<VoiceModeConfig>) => {
    const updated = { ...config, ...newConfig };
    setConfig(updated);
    onConfigChange?.(updated);
  };

  const getStabilityLabel = (value: number) => {
    if (value < 33) return 'Variable (expressive)';
    if (value < 67) return 'Balanced';
    return 'Consistent (steady)';
  };

  const getPitchLabel = (value: number) => {
    if (value < 33) return 'Lower (male)';
    if (value < 67) return 'Neutral';
    return 'Higher (female)';
  };

  const getSpeedLabel = (value: number) => {
    if (value < 33) return 'Slow';
    if (value < 67) return 'Normal';
    return 'Fast';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Accent selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: C.t1 }}>Accent</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {Object.entries(ACCENT_LABELS).map(([value, label]) => (
            <button
              key={value}
              onClick={() => handleChange({ accent: value as any })}
              style={{
                padding: '8px 12px',
                borderRadius: R.r1,
                border: `1px solid ${config.accent === value ? C.acc : C.bdr}`,
                background: config.accent === value ? C.acc : 'transparent',
                color: config.accent === value ? '#fff' : C.t2,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
                transition: 'transform 150ms ease, opacity 150ms ease',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Stability slider */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: C.t1 }}>
          Stability: {getStabilityLabel(config.stability)}
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={config.stability}
          onChange={(e) => handleChange({ stability: parseInt(e.target.value) })}
          style={{
            width: '100%',
            cursor: 'pointer',
            accentColor: C.acc,
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.t4 }}>
          <span>Variable</span>
          <span>Consistent</span>
        </div>
      </div>

      {/* Pitch slider */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: C.t1 }}>
          Pitch: {getPitchLabel(config.pitch)}
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={config.pitch}
          onChange={(e) => handleChange({ pitch: parseInt(e.target.value) })}
          style={{
            width: '100%',
            cursor: 'pointer',
            accentColor: C.acc,
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.t4 }}>
          <span>Lower</span>
          <span>Higher</span>
        </div>
      </div>

      {/* Speed slider */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: C.t1 }}>
          Speed: {getSpeedLabel(config.speed)}
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={config.speed}
          onChange={(e) => handleChange({ speed: parseInt(e.target.value) })}
          style={{
            width: '100%',
            cursor: 'pointer',
            accentColor: C.acc,
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.t4 }}>
          <span>Slower</span>
          <span>Faster</span>
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
        🔊 Preview Voice
      </button>

      {/* Info */}
      <div style={{ fontSize: 12, color: C.t4, marginTop: 4 }}>
        {ACCENT_LABELS[config.accent]} • {getStabilityLabel(config.stability).split('(')[0].trim()} • {getPitchLabel(config.pitch).split('(')[0].trim()}
      </div>
    </div>
  );
}
