'use client';

/**
 * VideoThumbnailSelector.tsx — Phase 3
 * 
 * Timeline scrubber with frame selection
 * - Scrub through video timeline
 * - Preview frames at current position
 * - Grid selection (1, 3, 5, 10 frames)
 * - Mark selected frame
 * - Save selection
 * 
 * Used after Phase 2 video analysis to let users pick thumbnail
 */

import React, { useState, useRef, useEffect } from 'react';
import { C, R } from './tokens';
import { AdvancedVideoPlayer } from './AdvancedVideoPlayer';

export interface SelectedThumbnail {
  timestamp: number;
  frameDataUrl: string;
  gridSize: 1 | 3 | 5 | 10;
}

export interface VideoThumbnailSelectorProps {
  videoUrl: string;
  duration: number;
  fps: number;
  onThumbnailSelected?: (thumbnail: SelectedThumbnail) => void;
  onCancel?: () => void;
}

type GridSize = 1 | 3 | 5 | 10;

export function VideoThumbnailSelector({
  videoUrl,
  duration,
  fps,
  onThumbnailSelected,
  onCancel,
}: VideoThumbnailSelectorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [gridSize, setGridSize] = useState<GridSize>(5);
  const [frames, setFrames] = useState<Array<{ timestamp: number; dataUrl: string }>>([]);
  const [selectedFrameIndex, setSelectedFrameIndex] = useState(0);
  const [isLoadingFrames, setIsLoadingFrames] = useState(false);
  const [previewFrame, setPreviewFrame] = useState<string | null>(null);
  const [showPlayer, setShowPlayer] = useState(false);

  // Extract frames at specific timestamps
  const extractFrames = async (gridSizeValue: GridSize) => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsLoadingFrames(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      const timestamps = Array.from({ length: gridSizeValue }, (_, i) => {
        return (i + 1) * (duration / (gridSizeValue + 1));
      });

      const newFrames: Array<{ timestamp: number; dataUrl: string }> = [];

      for (const timestamp of timestamps) {
        // Set video to timestamp
        videoRef.current.currentTime = timestamp;

        // Wait for frame to load with timeout
        try {
          await Promise.race([
            new Promise<void>(resolve => {
              const handler = () => {
                videoRef.current?.removeEventListener('seeked', handler);
                resolve();
              };
              videoRef.current?.addEventListener('seeked', handler);
            }),
            new Promise<void>((_, reject) =>
              setTimeout(() => reject(new Error(`Timeout at ${timestamp}s`)), 5000)
            )
          ]);
        } catch (error) {
          console.error('Frame extraction error:', error);
          throw new Error(`Failed to extract frame at ${timestamp}s. CORS issue or corrupted video.`);
        }

        // Draw frame to canvas
        canvas.width = 320;
        canvas.height = 180;
        ctx.drawImage(videoRef.current, 0, 0, 320, 180);

        // Convert to data URL
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        newFrames.push({ timestamp, dataUrl });
      }

      setFrames(newFrames);
      setSelectedFrameIndex(0);
      setCurrentTime(timestamps[0]);
    } catch (error) {
      console.error('Frame extraction error:', error);
    } finally {
      setIsLoadingFrames(false);
    }
  };

  // Extract frames when grid size changes
  useEffect(() => {
    extractFrames(gridSize);
  }, [gridSize, duration]);

  // Update preview when current time changes
  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    videoRef.current.currentTime = currentTime;

    const handler = () => {
      canvas.width = 320;
      canvas.height = 180;
      ctx.drawImage(videoRef.current!, 0, 0, 320, 180);
      setPreviewFrame(canvas.toDataURL('image/jpeg', 0.8));
      videoRef.current?.removeEventListener('seeked', handler);
    };

    videoRef.current.addEventListener('seeked', handler);

    return () => videoRef.current?.removeEventListener('seeked', handler);
  }, [currentTime]);

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    setCurrentTime(Math.max(0, Math.min(duration, percent * duration)));
  };

  const handleFrameSelect = (index: number) => {
    setSelectedFrameIndex(index);
    setCurrentTime(frames[index].timestamp);
  };

  const handleConfirm = () => {
    if (frames.length > 0 && previewFrame) {
      onThumbnailSelected?.({
        timestamp: currentTime,
        frameDataUrl: previewFrame,
        gridSize,
      });
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: '16px',
        background: C.bg2,
        borderRadius: R.r2,
      }}
    >
      {/* Hidden video element */}
      <video
        ref={videoRef}
        src={videoUrl}
        style={{ display: 'none' }}
        crossOrigin="anonymous"
      />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Title */}
      <div style={{ fontSize: 14, fontWeight: 500, color: C.t1 }}>
        Select Thumbnail Frame
      </div>

      {/* Preview */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          aspectRatio: '16/9',
          background: C.bg3,
          borderRadius: R.r1,
          overflow: 'hidden',
          minHeight: 180,
        }}
      >
        {previewFrame ? (
          <img
            src={previewFrame}
            alt="Preview"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <div style={{ color: C.t3, fontSize: 12 }}>Loading preview...</div>
        )}
      </div>

      {/* Timeline scrubber */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 12, color: C.t3 }}>
          {currentTime.toFixed(2)}s / {duration.toFixed(2)}s
        </div>
        <div
          onClick={handleTimelineClick}
          style={{
            position: 'relative',
            width: '100%',
            height: 6,
            background: C.bg3,
            borderRadius: R.r1,
            cursor: 'pointer',
            overflow: 'hidden',
          }}
        >
          {/* Progress bar */}
          <div
            style={{
              position: 'absolute',
              height: '100%',
              background: C.acc,
              width: '100%', transformOrigin: 'left', transform: `scaleX(${currentTime / duration})`,
              transition: 'transform 150ms ease',
            }}
          />
          {/* Scrubber handle */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: `${(currentTime / duration) * 100}%`,
              transform: 'translate(-50%, -50%)',
              width: 16,
              height: 16,
              background: C.acc,
              borderRadius: '50%',
              boxShadow: `0 2px 8px rgba(0,0,0,0.2)`,
              cursor: 'grab',
            }}
          />
        </div>
      </div>

      {/* Grid size selector */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[1, 3, 5, 10].map((size) => (
          <button
            key={size}
            onClick={() => setGridSize(size as GridSize)}
            style={{
              padding: '8px 12px',
              borderRadius: R.r1,
              border: `1px solid ${gridSize === size ? C.acc : C.bdr}`,
              background: gridSize === size ? C.acc : C.bg3,
              color: gridSize === size ? '#fff' : C.t2,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
              transition: 'transform 150ms ease, opacity 150ms ease',
            }}
            onMouseOver={(e) => {
              if (gridSize !== size) {
                (e.target as HTMLButtonElement).style.background = C.bg3;
                (e.target as HTMLButtonElement).style.borderColor = C.acc;
              }
            }}
            onMouseOut={(e) => {
              if (gridSize !== size) {
                (e.target as HTMLButtonElement).style.background = C.bg3;
                (e.target as HTMLButtonElement).style.borderColor = C.bdr;
              }
            }}
          >
            {size} frame{size > 1 ? 's' : ''}
          </button>
        ))}
      </div>

      {/* Frame grid */}
      {isLoadingFrames ? (
        <div style={{ fontSize: 12, color: C.t3, textAlign: 'center', padding: '12px' }}>
          Extracting frames...
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fit, minmax(80px, 1fr))`,
            gap: 8,
          }}
        >
          {frames.map((frame, index) => (
            <div
              key={index}
              onClick={() => handleFrameSelect(index)}
              style={{
                position: 'relative',
                cursor: 'pointer',
                borderRadius: R.r1,
                overflow: 'hidden',
                border: `2px solid ${selectedFrameIndex === index ? C.acc : 'transparent'}`,
                aspectRatio: '16/9',
                transition: 'transform 150ms ease, opacity 150ms ease',
              }}
              onMouseOver={(e) => {
                (e.currentTarget as HTMLDivElement).style.opacity = '0.8';
              }}
              onMouseOut={(e) => {
                (e.currentTarget as HTMLDivElement).style.opacity = '1';
              }}
            >
              <img
                src={frame.dataUrl}
                alt={`Frame ${index + 1}`}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
              {selectedFrameIndex === index && (
                <div
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    width: 20,
                    height: 20,
                    background: C.acc,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  ✓
                </div>
              )}
              <div
                style={{
                  position: 'absolute',
                  bottom: 4,
                  left: 4,
                  fontSize: 12,
                  color: '#fff',
                  background: 'rgba(0,0,0,0.5)',
                  padding: '2px 6px',
                  borderRadius: 8,
                  fontWeight: 500,
                }}
              >
                {frame.timestamp.toFixed(1)}s
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button
          onClick={handleConfirm}
          disabled={frames.length === 0}
          style={{
            flex: 1,
            padding: '12px 16px',
            borderRadius: R.r1,
            border: 'none',
            background: frames.length === 0 ? C.bg3 : C.acc,
            color: frames.length === 0 ? C.t4 : '#fff',
            cursor: frames.length === 0 ? 'not-allowed' : 'pointer',
            fontSize: 13,
            fontWeight: 500,
            transition: 'transform 150ms ease, opacity 150ms ease',
          }}
          onMouseOver={(e) => {
            if (frames.length > 0) {
              (e.target as HTMLButtonElement).style.opacity = '0.9';
            }
          }}
          onMouseOut={(e) => {
            if (frames.length > 0) {
              (e.target as HTMLButtonElement).style.opacity = '1';
            }
          }}
        >
          Use Selected Frame
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: '12px 16px',
            borderRadius: R.r1,
            border: `1px solid ${C.bdr}`,
            background: 'transparent',
            color: C.t2,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
            transition: 'transform 150ms ease, opacity 150ms ease',
          }}
          onMouseOver={(e) => {
            (e.target as HTMLButtonElement).style.background = C.bg3;
          }}
          onMouseOut={(e) => {
            (e.target as HTMLButtonElement).style.background = 'transparent';
          }}
        >
          Cancel
        </button>
      </div>

      {/* Info text */}
      <div style={{ fontSize: 12, color: C.t4, lineHeight: 1.5 }}>
        Click on a frame to select it as your thumbnail. You can also drag the timeline scrubber to preview any point in the video. Selected frame will be used as the video thumbnail.
      </div>

      {/* Phase 4: Advanced Video Player (Optional) */}
      {showPlayer && (
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: `1px solid ${C.bdr}` }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: C.t1, marginBottom: 12 }}>
            ▶ Advanced Video Editing
          </div>
          <AdvancedVideoPlayer
            videoUrl={videoUrl}
            duration={duration}
            fps={fps}
            onSegmentCreated={(segment) => {
              console.log('Segment created:', segment);
            }}
            onSegmentDeleted={(segmentId) => {
              console.log('Segment deleted:', segmentId);
            }}
          />
          <button
            onClick={() => setShowPlayer(false)}
            style={{
              marginTop: 8,
              width: '100%',
              padding: '8px 12px',
              borderRadius: R.r1,
              border: `1px solid ${C.bdr}`,
              background: 'transparent',
              color: C.t2,
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Close Editor
          </button>
        </div>
      )}

      {/* Toggle advanced editor button */}
      {!showPlayer && (
        <button
          onClick={() => setShowPlayer(true)}
          style={{
            marginTop: 8,
            width: '100%',
            padding: '8px 12px',
            borderRadius: R.r1,
            border: `1px solid ${C.acc}`,
            background: 'transparent',
            color: C.acc,
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          ▶ Open Advanced Video Editor
        </button>
      )}
    </div>
  );
}
