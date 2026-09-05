'use client';

import React, { useState } from 'react';
import { api } from '@/lib/api-client';
import { SearchResult } from '@/lib/types';
import { Database, Plus, Search, Trash2 } from 'lucide-react';

export default function RagView() {
  const [docContent, setDocContent] = useState('');
  const [docId, setDocId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleIngest = async () => {
    if (!docContent.trim()) return;
    setLoading(true);
    try {
      const id = docId.trim() || `doc_${Date.now()}`;
      await api.ingestDocs([{ id, content: docContent.trim() }]);
      setStatusMessage(`Successfully indexed document: ${id}`);
      setDocContent('');
      setDocId('');
    } catch (e: any) {
      setStatusMessage(`Ingest failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const res = await api.searchRag(searchQuery.trim(), 4);
      setResults(res);
      setStatusMessage(`Found ${res.length} matches.`);
    } catch (e: any) {
      setStatusMessage(`Search failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 600 }}>RAG Knowledge Engine</h2>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Ingest local documentation and verify vector similarity retrieval.
        </p>
      </div>

      {statusMessage && (
        <div className="badge badge-success" style={{ alignSelf: 'flex-start' }}>
          {statusMessage}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Ingestion Panel */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={16} color="var(--accent-cyan)" />
            <span>Ingest Document</span>
          </h3>
          <input
            className="input"
            placeholder="Document ID (optional)"
            value={docId}
            onChange={(e) => setDocId(e.target.value)}
          />
          <textarea
            className="textarea"
            rows={5}
            placeholder="Enter text or markdown content to index..."
            value={docContent}
            onChange={(e) => setDocContent(e.target.value)}
          />
          <button
            className="btn btn-primary"
            onClick={handleIngest}
            disabled={loading || !docContent.trim()}
          >
            Index Document
          </button>
        </div>

        {/* Search Panel */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Search size={16} color="var(--accent-indigo)" />
            <span>Semantic Vector Search</span>
          </h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              className="input"
              placeholder="Query semantic index..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button
              className="btn btn-secondary"
              onClick={handleSearch}
              disabled={loading || !searchQuery.trim()}
            >
              Search
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px', maxHeight: '300px', overflowY: 'auto' }}>
            {results.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                No search results to display yet.
              </div>
            ) : (
              results.map((r, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '10px',
                    borderRadius: '6px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <span>ID: {r.document.id}</span>
                    <span style={{ color: 'var(--accent-cyan)' }}>Similarity: {(r.score * 100).toFixed(1)}%</span>
                  </div>
                  <div style={{ fontSize: '13px', marginTop: '6px' }}>{r.document.content}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
