'use client';

import React, { useState, useCallback } from 'react';
import { C } from './tokens';

interface SearchResult {
  id: string;
  type: 'message' | 'artifact';
  content?: string;
  name?: string;
  role?: string;
  conversationId: string;
  conversationTitle?: string;
  createdAt: string;
}

interface SearchPanelProps {
  onSelectResult?: (result: SearchResult) => void;
  onClose?: () => void;
}

export function SearchPanel({ onSelectResult, onClose }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/streams/search?q=${encodeURIComponent(q)}&limit=20`
      );
      if (!response.ok) throw new Error('Search failed');

      const data = await response.json();
      const allResults = [
        ...(data.messages || []),
        ...(data.artifacts || []),
      ].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
      );
      setResults(allResults);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Search failed'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    handleSearch(value);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 300,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: C.bg2,
          padding: '16px',
          borderBottom: `1px solid ${C.t4}`,
          display: 'flex',
          gap: '8px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          placeholder="Search conversations..."
          autoFocus
          style={{
            flex: 1,
            padding: '8px 12px',
            backgroundColor: C.bg3,
            color: C.t1,
            border: `1px solid ${C.t4}`,
            borderRadius: '6px',
            fontSize: '12px',
            lineHeight: 1.4,
          }}
        />
        <button
          onClick={onClose}
          style={{
            padding: '8px 12px',
            backgroundColor: C.bg3,
            color: C.t1,
            border: `1px solid ${C.t4}`,
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
            lineHeight: 1.4,
          }}
        >
          Close
        </button>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {error && (
          <p style={{ color: C.red, fontSize: '12px', lineHeight: 1.4 }}>
            {error}
          </p>
        )}

        {isLoading && (
          <p style={{ color: C.t3, fontSize: '12px', lineHeight: 1.4 }}>
            Searching...
          </p>
        )}

        {results.length === 0 && !isLoading && query && (
          <p style={{ color: C.t4, fontSize: '12px', lineHeight: 1.4 }}>
            No results found
          </p>
        )}

        {results.map((result) => (
          <div
            key={`${result.type}-${result.id}`}
            onClick={() => onSelectResult?.(result)}
            style={{
              padding: '12px',
              backgroundColor: C.bg3,
              borderRadius: '8px',
              cursor: 'pointer',
              border: `1px solid ${C.t4}`,
              transition: 'background-color 150ms ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.backgroundColor = C.bg1;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.backgroundColor = C.bg3;
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'flex-start',
                marginBottom: '4px',
              }}
            >
              <span
                style={{
                  fontSize: '10px',
                  padding: '2px 6px',
                  backgroundColor: C.acc,
                  color: C.bg,
                  borderRadius: '4px',
                  fontWeight: 500,
                  lineHeight: 1.2,
                }}
              >
                {result.type === 'message' ? 'Message' : 'Artifact'}
              </span>
              {result.conversationTitle && (
                <span
                  style={{
                    fontSize: '11px',
                    color: C.t3,
                    lineHeight: 1.4,
                  }}
                >
                  in: {result.conversationTitle}
                </span>
              )}
            </div>

            {result.type === 'message' && result.content && (
              <p
                style={{
                  fontSize: '12px',
                  color: C.t1,
                  margin: '0 0 8px 0',
                  lineHeight: 1.4,
                }}
              >
                {result.content.substring(0, 150)}
                {result.content.length > 150 ? '...' : ''}
              </p>
            )}

            {result.type === 'artifact' && result.name && (
              <p
                style={{
                  fontSize: '12px',
                  color: C.t1,
                  margin: '0 0 8px 0',
                  fontWeight: 500,
                  lineHeight: 1.4,
                }}
              >
                {result.name}
              </p>
            )}

            <p
              style={{
                fontSize: '10px',
                color: C.t4,
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              {new Date(result.createdAt).toLocaleDateString()}{' '}
              {new Date(result.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SearchPanel;
