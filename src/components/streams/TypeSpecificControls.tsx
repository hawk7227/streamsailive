'use client';

/**
 * Phase 5: TypeSpecificControls
 * 
 * Router component that shows the right controls based on generation mode
 * Integrates all 4 mode controllers (Image, Video, Voice, Music)
 */

import React from 'react';
import { C, R } from './tokens';
import { ImageModeControls, ImageModeConfig } from './ImageModeControls';
import { VideoModeControls, VideoModeConfig } from './VideoModeControls';
import { VoiceModeControls, VoiceModeConfig } from './VoiceModeControls';
import { MusicModeControls, MusicModeConfig } from './MusicModeControls';

export type GenerationMode = 'image' | 'video' | 'voice' | 'music' | 'motion' | 'i2v';

export type ModeConfig = ImageModeConfig | VideoModeConfig | VoiceModeConfig | MusicModeConfig;

export interface TypeSpecificControlsProps {
  mode: GenerationMode;
  onConfigChange?: (config: ModeConfig) => void;
}

const MODE_LABELS: Record<GenerationMode, string> = {
  image: '🖼️ Image',
  video: '🎬 Video',
  voice: '🎤 Voice',
  music: '🎵 Music',
  motion: '🎞️ Motion',
  i2v: '📷→🎬 Image to Video',
};

export function TypeSpecificControls({ mode, onConfigChange }: TypeSpecificControlsProps) {
  return (
    <div
      style={{
        padding: 12,
        background: C.bg2,
        borderRadius: R.r1,
        border: `1px solid ${C.bdr}`,
      }}
    >
      {/* Mode header */}
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: C.t1,
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {MODE_LABELS[mode]}
      </div>

      {/* Mode-specific controls */}
      {mode === 'image' && (
        <ImageModeControls onConfigChange={onConfigChange as any} />
      )}

      {mode === 'video' && (
        <VideoModeControls onConfigChange={onConfigChange as any} />
      )}

      {mode === 'voice' && (
        <VoiceModeControls onConfigChange={onConfigChange as any} />
      )}

      {mode === 'music' && (
        <MusicModeControls onConfigChange={onConfigChange as any} />
      )}

      {(mode === 'motion' || mode === 'i2v') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <VideoModeControls onConfigChange={onConfigChange as any} />
          <div
            style={{
              paddingTop: 12,
              borderTop: `1px solid ${C.bdr}`,
              fontSize: 11,
              color: C.t4,
            }}
          >
            {mode === 'motion'
              ? 'Motion capture uses video settings (aspect ratio, motion intensity, fps, duration)'
              : 'Image-to-video generation uses video settings with automatic scene transition'}
          </div>
        </div>
      )}
    </div>
  );
}
