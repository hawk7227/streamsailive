"use client";

import React, { useEffect, useState } from 'react';

interface IntegrationCredentialState {
  provider: string;
  configured: boolean;
  scopes?: string[];
}

export function IntegrationCredentialsPanel() {
  const [items, setItems] = useState<IntegrationCredentialState[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch('/api/operator/integrations-credentials').then((r) => r.json()).then((json) => setItems(json.data || [])).finally(() => setLoading(false));
  }, []);

  return (
    <section className="rounded-2xl border border-white/10 bg-[#0b0f14] p-4 text-white">
      <h3 className="text-sm font-semibold text-white/90">Integration credentials</h3>
      <div className="mt-3 grid gap-2">
        {loading && <div className="text-sm text-white/50">Loading…</div>}
        {items.map((item) => (
          <div key={item.provider} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-sm">
            <div>
              <div className="font-medium">{item.provider}</div>
              <div className="text-xs text-white/45">{item.scopes?.join(', ') || 'No scopes listed'}</div>
            </div>
            <div className={item.configured ? 'text-emerald-300' : 'text-red-300'}>{item.configured ? 'Configured' : 'Missing'}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
