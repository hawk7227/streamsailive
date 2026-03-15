"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface ApiKey {
  id: string;
  name: string;
  key: string;
  created_at: string;
  last_used_at: string | null;
}

interface AnalyticsData {
  date: string;
  total: number;
  success: number;
  error: number;
}

export default function ApiDashboardPage() {
  const { user } = useAuth();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [keysRes, analyticsRes] = await Promise.all([
        fetch("/api/keys"),
        fetch("/api/keys/analytics"),
      ]);

      const keysData = await keysRes.json();
      const analyticsData = await analyticsRes.json();

      if (keysRes.ok) setKeys(keysData.data);
      if (analyticsRes.ok) setAnalytics(analyticsData.data);
    } catch (error) {
      console.error("Failed to load API data", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async () => {
    try {
      const response = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName }),
      });
      const data = await response.json();
      if (response.ok) {
        setCreatedKey(data.data.key);
        setNewKeyName("");
        fetchData(); // Refresh list
      }
    } catch (error) {
      console.error("Failed to create key", error);
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm("Are you sure? This action cannot be undone.")) return;
    try {
      await fetch(`/api/keys?id=${id}`, { method: "DELETE" });
      fetchData();
    } catch (error) {
      console.error("Failed to delete key", error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const maxRequests = Math.max(...analytics.map((d) => d.total), 1);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-2">API Access</h1>
        <p className="text-text-secondary">
          Manage your API keys and view usage analytics.
        </p>
      </div>

      {/* Analytics Chart */}
      <div className="bg-bg-secondary border border-border-color rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-6">Requests (Last 30 Days)</h2>
        <div className="h-48 flex items-end gap-2">
          {analytics.map((day) => (
            <div
              key={day.date}
              className="flex-1 flex flex-col items-center gap-1 group relative"
            >
                {/* Tooltip */}
                <div className="absolute bottom-full mb-2 hidden group-hover:block bg-bg-tertiary border border-border-color p-2 rounded text-xs whitespace-nowrap z-10">
                    <p className="font-semibold">{day.date}</p>
                    <p>Total: {day.total}</p>
                    <p className="text-accent-emerald">Success: {day.success}</p>
                    <p className="text-accent-red">Error: {day.error}</p>
                </div>
              <div
                className="w-full bg-accent-indigo/20 rounded-t-sm hover:bg-accent-indigo/40 transition-colors relative overflow-hidden"
                style={{ height: `${(day.total / maxRequests) * 100}%` }}
              >
                  {/* Error portion overlay */}
                  <div 
                    className="absolute bottom-0 w-full bg-accent-red/40"
                    style={{ height: `${(day.error / Math.max(day.total, 1)) * 100}%` }}
                  />
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-xs text-text-muted">
            <span>30 Days ago</span>
            <span>Today</span>
        </div>
      </div>

      {/* API Keys */}
      <div className="bg-bg-secondary border border-border-color rounded-2xl p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold">API Keys</h2>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-gradient-to-r from-accent-indigo to-accent-purple text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Create New Key
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-text-muted uppercase text-xs border-b border-border-color">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Key</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Last Used</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                    <td colSpan={5} className="text-center py-6 text-text-muted">Loading...</td>
                </tr>
              ) : keys.length === 0 ? (
                 <tr>
                    <td colSpan={5} className="text-center py-6 text-text-muted">No API keys found.</td>
                </tr>
              ) : (
                keys.map((key) => (
                  <tr key={key.id} className="border-b border-border-color/50 last:border-0 hover:bg-bg-tertiary/20">
                    <td className="px-4 py-3 font-medium">{key.name}</td>
                    <td className="px-4 py-3 font-mono text-text-secondary">{key.key}</td>
                    <td className="px-4 py-3 text-text-muted">
                      {new Date(key.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {key.last_used_at
                        ? new Date(key.last_used_at).toLocaleDateString()
                        : "Never"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDeleteKey(key.id)}
                        className="text-accent-red hover:text-accent-red/80 font-medium"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Documentation */}
      <div className="bg-gradient-to-r from-accent-indigo/10 to-accent-purple/10 border border-border-color rounded-2xl p-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-lg font-semibold">API Documentation</h2>
          <p className="text-sm text-text-secondary mt-1">
            Learn how to authenticate requests and use the StreamsAI API endpoints.
          </p>
        </div>
        <a
          href="/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 bg-text-primary text-bg-primary rounded-lg text-sm font-semibold hover:bg-white transition-colors"
        >
          View Full Documentation
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="w-4 h-4"
          >
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
      </div>

      {/* Create Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-bg-secondary border border-border-color rounded-2xl p-6 w-full max-w-md shadow-2xl">
            {createdKey ? (
              <div className="space-y-4">
                 <div className="w-12 h-12 bg-accent-emerald/20 text-accent-emerald rounded-full flex items-center justify-center mx-auto mb-2">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6">
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                 </div>
                <h3 className="text-lg font-bold text-center">Key Created Successfully</h3>
                <p className="text-sm text-center text-text-secondary">
                  Please copy your key now. You won't be able to see it again.
                </p>
                
                <div className="relative">
                    <div className="bg-bg-tertiary p-3 rounded-lg font-mono text-sm break-all pr-10 border border-border-color">
                        {createdKey}
                    </div>
                     <button 
                        onClick={() => copyToClipboard(createdKey)}
                        className="absolute right-2 top-2 p-1.5 text-text-muted hover:text-white bg-bg-primary rounded-md border border-border-color"
                        title="Copy"
                     >
                        {copySuccess ? (
                             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-accent-emerald"><polyline points="20 6 9 17 4 12" /></svg>
                        ) : (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        )}
                    </button>
                </div>

                <button
                  onClick={() => {
                      setIsCreateModalOpen(false);
                      setCreatedKey(null);
                  }}
                   className="w-full py-2 bg-gradient-to-r from-accent-indigo to-accent-purple text-white rounded-lg text-sm font-semibold mt-4"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-bold mb-4">Create New API Key</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Name</label>
                    <input
                      type="text"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="e.g. Production App"
                      className="w-full bg-bg-tertiary border border-border-color rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-accent-indigo transition-colors"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setIsCreateModalOpen(false)}
                      className="flex-1 py-2 border border-border-color rounded-lg text-sm font-medium hover:bg-bg-tertiary"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateKey}
                      disabled={!newKeyName.trim()}
                      className="flex-1 py-2 bg-gradient-to-r from-accent-indigo to-accent-purple text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                    >
                      Create
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
