"use client";

import React, { useEffect, useState } from 'react';

interface PipelineSession {
  id: string;
  status: string;
  created_at: string;
  current_step?: string;
  mode?: string;
}

export function PipelineSessionsPanel() {
  const [data, setData] = useState<PipelineSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch('/api/operator/pipeline-sessions').then((r) => r.json()).then((json) => setData(json.data || [])).finally(() => setLoading(false));
  }, []);

  return (
    <section className="rounded-2xl border border-white/10 bg-[#0b0f14] p-4 text-white">
      <h3 className="text-sm font-semibold text-white/90">Pipeline sessions</h3>
      <div className="mt-3 grid gap-2">
        {loading && <div className="text-sm text-white/50">Loading…</div>}
        {data.map((item) => (
          <div key={item.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-sm">
            <div>
              <div className="font-medium">{item.id.slice(0, 8)}</div>
              <div className="text-xs text-white/45">{item.current_step || 'No active step'} • {new Date(item.created_at).toLocaleString()}</div>
            </div>
            <div className="text-cyan-300">{item.status}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
