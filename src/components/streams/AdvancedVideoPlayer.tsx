'use client';

/**
 * AdvancedVideoPlayer.tsx — Phase 4
 * 
 * Frame-by-frame video navigation with segments
 * - Navigate with arrow keys (← →)
 * - Current frame display
 * - Playback speed (0.5x, 1x, 2x)
 * - Loop segment
 * - Segment marking (in/out points)
 * - Keyboard shortcuts
 */

import React, { useState, useRef, useEffect } from 'react';
import { C, R } from './tokens';

export interface VideoSegment {
  id: string;
  label: string;
  startFrame: number;
  endFrame: number;
  color: string;
}

export interface AdvancedVideoPlayerProps {
  videoUrl: string;
  duration: number;
  fps: number;
  onSegmentCreated?: (segment: VideoSegment) => void;
  onSegmentDeleted?: (segmentId: string) => void;
}

type PlaybackSpeed = 0.5 | 1 | 1.5 | 2;

export function AdvancedVideoPlayer({
  videoUrl,
  duration,
  fps,
  onSegmentCreated,
  onSegmentDeleted,
}: AdvancedVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [segments, setSegments] = useState<VideoSegment[]>([]);
  const [markedInPoint, setMarkedInPoint] = useState<number | null>(null);
  const [isLoopingSegment, setIsLoopingSegment] = useState(false);
  const [showSegmentForm, setShowSegmentForm] = useState(false);
  const [segmentLabel, setSegmentLabel] = useState('');

  const totalFrames = Math.ceil(duration * fps);
  const currentFrame = Math.round(currentTime * fps);

  // Update playback speed
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!videoRef.current) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          setIsPlaying(!isPlaying);
          if (!isPlaying) videoRef.current.play();
          else videoRef.current.pause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setCurrentTime(Math.max(0, currentTime - 1 / fps));
          break;
        case 'ArrowRight':
          e.preventDefault();
          setCurrentTime(Math.min(duration, currentTime + 1 / fps));
          break;
        case '[':
          e.preventDefault();
          setMarkedInPoint(currentTime);
          break;
        case ']':
          e.preventDefault();
          if (markedInPoint !== null) {
            const newSegment: VideoSegment = {
              id: `seg-${Date.now()}`,
              label: segmentLabel || `Segment ${segments.length + 1}`,
              startFrame: Math.round(markedInPoint * fps),
              endFrame: currentFrame,
              color: ['#7c3aed', '#10b981', '#f59e0b', '#ef4444'][segments.length % 4],
            };
            setSegments([...segments, newSegment]);
            onSegmentCreated?.(newSegment);
            setMarkedInPoint(null);
            setSegmentLabel('');
          }
          break;
        case 'l':
        case 'L':
          e.preventDefault();
          setIsLoopingSegment(!isLoopingSegment);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTime, isPlaying, markedInPoint, segmentLabel, segments, duration, fps, isLoopingSegment]);

  // Loop segment
  useEffect(() => {
    if (!videoRef.current || !isLoopingSegment || segments.length === 0) return;

    const handleTimeUpdate = () => {
      if (!videoRef.current) return;

      const loopSegment = segments[segments.length - 1];
      const segmentEndTime = loopSegment.endFrame / fps;

      if (videoRef.current.currentTime >= segmentEndTime) {
        videoRef.current.currentTime = loopSegment.startFrame / fps;
      }
    };

    videoRef.current.addEventListener('timeupdate', handleTimeUpdate);
    return () => videoRef.current?.removeEventListener('timeupdate', handleTimeUpdate);
  }, [isLoopingSegment, segments, fps]);

  // Update current time
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = currentTime;
    }
  }, [currentTime]);

  const handlePlayPause = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleFrameNavigate = (offset: number) => {
    const newTime = Math.max(0, Math.min(duration, currentTime + offset / fps));
    setCurrentTime(newTime);
  };

  const deleteSegment = (id: string) => {
    setSegments(segments.filter((s) => s.id !== id));
    onSegmentDeleted?.(id);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: 16,
        background: C.bg2,
        borderRadius: R.r2,
      }}
    >
      {/* Video player */}
      <video
        ref={videoRef}
        src={videoUrl}
        style={{
          width: '100%',
          background: '#000',
          borderRadius: R.r1,
          maxHeight: 400,
        }}
        crossOrigin="anonymous"
        onTimeUpdate={(e) => setCurrentTime((e.target as HTMLVideoElement).currentTime)}
      />

      {/* Frame counter */}
      <div style={{ fontSize: 12, color: C.t3 }}>
        Frame {currentFrame} / {totalFrames} ({currentTime.toFixed(2)}s / {duration.toFixed(2)}s)
      </div>

      {/* Playback controls */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={handlePlayPause}
          style={{
            padding: '8px 12px',
            borderRadius: R.r1,
            border: 'none',
            background: C.acc,
            color: '#fff',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
            minWidth: 48,
          }}
        >
          {isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>

        {/* Speed control */}
        <select
          value={playbackSpeed}
          onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value) as PlaybackSpeed)}
          style={{
            padding: '8px 8px',
            borderRadius: R.r1,
            border: `1px solid ${C.bdr}`,
            background: C.bg3,
            color: C.t2,
            cursor: 'pointer',
            fontSize: 12,
            fontFamily: 'inherit',
          }}
        >
          <option value={0.5}>0.5x</option>
          <option value={1}>1x</option>
          <option value={1.5}>1.5x</option>
          <option value={2}>2x</option>
        </select>

        {/* Frame navigation */}
        <button
          onClick={() => handleFrameNavigate(-1)}
          title="Previous frame (←)"
          style={{
            padding: '8px 12px',
            borderRadius: R.r1,
            border: `1px solid ${C.bdr}`,
            background: 'transparent',
            color: C.t2,
            cursor: 'pointer',
            fontSize: 12,
            minWidth: 44,
          }}
        >
          ← Frame
        </button>

        <button
          onClick={() => handleFrameNavigate(1)}
          title="Next frame (→)"
          style={{
            padding: '8px 12px',
            borderRadius: R.r1,
            border: `1px solid ${C.bdr}`,
            background: 'transparent',
            color: C.t2,
            cursor: 'pointer',
            fontSize: 12,
            minWidth: 44,
          }}
        >
          Frame →
        </button>

        {/* Loop segment */}
        <button
          onClick={() => setIsLoopingSegment(!isLoopingSegment)}
          style={{
            padding: '8px 12px',
            borderRadius: R.r1,
            border: `1px solid ${isLoopingSegment ? C.acc : C.bdr}`,
            background: isLoopingSegment ? C.acc : 'transparent',
            color: isLoopingSegment ? '#fff' : C.t2,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
          }}
          title="Loop current segment (L)"
        >
          🔁 Loop
        </button>
      </div>

      {/* Segment marking */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={() => setMarkedInPoint(currentTime)}
          style={{
            padding: '8px 12px',
            borderRadius: R.r1,
            border: `1px solid ${markedInPoint !== null ? C.acc : C.bdr}`,
            background: markedInPoint !== null ? C.acc : 'transparent',
            color: markedInPoint !== null ? '#fff' : C.t2,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
          }}
          title="Mark in point ([)"
        >
          {markedInPoint !== null ? `[In @ ${markedInPoint.toFixed(1)}s]` : '[Mark In'}
        </button>

        {markedInPoint !== null && (
          <>
            <button
              onClick={() => {
                setShowSegmentForm(true);
              }}
              style={{
                padding: '8px 12px',
                borderRadius: R.r1,
                border: `1px solid ${C.acc}`,
                background: 'transparent',
                color: C.acc,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
              }}
              title="Create segment (])"
            >
              Mark Out & Create
            </button>

            <button
              onClick={() => setMarkedInPoint(null)}
              style={{
                padding: '8px 12px',
                borderRadius: R.r1,
                border: `1px solid ${C.bdr}`,
                background: 'transparent',
                color: C.t3,
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              Cancel
            </button>
          </>
        )}
      </div>

      {/* Segment label input */}
      {showSegmentForm && markedInPoint !== null && (
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            placeholder="Segment name (Intro, Main, Outro...)"
            value={segmentLabel}
            onChange={(e) => setSegmentLabel(e.target.value)}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: R.r1,
              border: 'none',
              background: C.bg3,
              color: C.t1,
              fontSize: 12,
              fontFamily: 'inherit',
            }}
          />
          <button
            onClick={() => {
              const newSegment: VideoSegment = {
                id: `seg-${Date.now()}`,
                label: segmentLabel || `Segment ${segments.length + 1}`,
                startFrame: Math.round(markedInPoint * fps),
                endFrame: currentFrame,
                color: ['#7c3aed', '#10b981', '#f59e0b', '#ef4444'][segments.length % 4],
              };
              setSegments([...segments, newSegment]);
              onSegmentCreated?.(newSegment);
              setMarkedInPoint(null);
              setSegmentLabel('');
              setShowSegmentForm(false);
            }}
            style={{
              padding: '8px 16px',
              borderRadius: R.r1,
              border: 'none',
              background: C.acc,
              color: '#fff',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            Create
          </button>
        </div>
      )}

      {/* Segments list */}
      {segments.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: C.t1 }}>Segments ({segments.length})</div>
          {segments.map((segment) => (
            <div
              key={segment.id}
              style={{
                padding: 8,
                borderRadius: R.r1,
                background: C.bg3,
                borderLeft: `4px solid ${segment.color}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ fontSize: 12 }}>
                <div style={{ fontWeight: 500, color: C.t1 }}>{segment.label}</div>
                <div style={{ color: C.t3, marginTop: 2 }}>
                  Frame {segment.startFrame} → {segment.endFrame} ({(segment.startFrame / fps).toFixed(1)}s → {(segment.endFrame / fps).toFixed(1)}s)
                </div>
              </div>
              <button
                onClick={() => deleteSegment(segment.id)}
                style={{
                  padding: '4px 8px',
                  borderRadius: R.r1,
                  border: 'none',
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: C.red,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Keyboard shortcuts info */}
      <div style={{ fontSize: 12, color: C.t4, lineHeight: 1.6 }}>
        <strong>Keyboard shortcuts:</strong>
        <div>Space: Play/Pause | ← →: Frame nav | [: Mark in | ]: Mark out | L: Loop segment</div>
      </div>
    </div>
  );
}
