'use client';

import { C } from './tokens';

export function VideoLibrary({ 
  videos = [] 
}: { 
  videos?: Array<{
    id: string;
    url: string;
    title: string;
    createdAt: string;
  }>;
}) {
  if (videos.length === 0) {
    return (
      <div style={{
        padding: 24,
        textAlign: 'center',
        color: C.t4,
        fontSize: 13,
      }}>
        No videos yet. Generate one to get started.
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, padding: 16 }}>
      {videos.map(video => (
        <div key={video.id} style={{
          border: `1px solid ${C.bdr}`,
          borderRadius: 12,
          overflow: 'hidden',
          backgroundColor: C.bg2,
        }}>
          <video src={video.url} style={{ width: '100%', height: 'auto', display: 'block' }} />
          <div style={{ padding: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.t1, marginBottom: 4 }}>{video.title}</div>
            <div style={{ fontSize: 11, color: C.t3 }}>{video.createdAt}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
