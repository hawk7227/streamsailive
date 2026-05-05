'use client';

import { useState, useEffect } from 'react';
import { VideoLibrary } from '../VideoLibrary';
import { C } from '../tokens';

export default function VideosTab() {
  const [videos, setVideos] = useState<Array<{
    id: string;
    url: string;
    title: string;
    createdAt: string;
  }>>([]);

  useEffect(() => {
    // Fetch videos from library/storage
    // For now, empty list
    setVideos([]);
  }, []);

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      padding: '16px',
      overflow: 'auto',
    }}>
      <div style={{
        fontSize: 18,
        fontWeight: 600,
        color: C.t1,
        marginBottom: 16,
      }}>
        Videos
      </div>
      <VideoLibrary videos={videos} />
    </div>
  );
}
