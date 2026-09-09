'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Database, FileText, Plus, RefreshCw, Search, Trash2, UploadCloud } from 'lucide-react';
import { api, normalizeError } from '@/lib/api-client';
import { AppError, SearchResult } from '@/lib/types';
import { apply3DTilt, reset3DTilt } from '@/lib/animations';

interface KnowledgeBayProps {
  onError: (error: AppError) => void;
}

export default function KnowledgeBay({ onError }: KnowledgeBayProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState<{ total_documents: number; backend: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      const data = await api.getRagStats();
      setStats(data);
    } catch (err) {
      // ignore or set default
      setStats({ total_documents: 0, backend: 'ChromaDB' });
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || searching) return;
    setSearching(true);
    try {
      const results = await api.searchRag(searchQuery.trim(), 4);
      setSearchResults(results);
    } catch (err) {
      onError(normalizeError(err, 'VALIDATION_ERROR'));
    } finally {
      setSearching(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.pdf')) {
      onError({
        code: 'VALIDATION_ERROR',
        message: 'Unsupported document format. Only PDF files are supported.',
        severity: 'warning',
        timestamp: new Date().toISOString(),
        suggestedAction: 'Select a valid .pdf file to ingest into vector storage.',
      });
      return;
    }

    setUploading(true);
    setUploadStatus(`Ingesting ${file.name}...`);
    try {
      const res = await api.uploadPdf(file, 500, 50);
      setUploadStatus(`Ingested "${res.filename}" (${res.total_chunks} chunks, ${res.total_pages} pages).`);
      fetchStats();
    } catch (err) {
      setUploadStatus(null);
      onError(normalizeError(err, 'VALIDATION_ERROR'));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleClearRag = async () => {
    if (!confirm('Are you sure you want to clear the local vector database?')) return;
    try {
      await api.clearRag();
      setSearchResults([]);
      fetchStats();
      setUploadStatus('Vector database cleared.');
    } catch (err) {
      onError(normalizeError(err, 'VALIDATION_ERROR'));
    }
  };

  return (
    <div
      className="workbench-bay-card"
      ref={cardRef}
      onMouseMove={(e) => apply3DTilt(cardRef.current, e, 4, 6)}
      onMouseLeave={() => reset3DTilt(cardRef.current)}
    >
      <div className="bay-header">
        <div className="bay-title-group">
          <Database className="bay-icon" size={20} />
          <div>
            <h3>Vector Knowledge Field</h3>
            <p>Air-gapped semantic retrieval powered by ChromaDB & local nomic embeddings.</p>
          </div>
        </div>

        <div className="bay-stats-cluster">
          <div className="stat-pill">
            <span>INDEXED CHUNKS</span>
            <strong>{stats?.total_documents ?? 0}</strong>
          </div>
          <div className="stat-pill">
            <span>BACKEND</span>
            <strong>{stats?.backend ?? 'ChromaDB'}</strong>
          </div>
          <button
            type="button"
            className="stat-refresh-btn"
            onClick={fetchStats}
            aria-label="Refresh vector stats"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div className="bay-content-grid">
        {/* Search Vector Memory */}
        <div className="bay-subcard">
          <h4>Semantic Memory Query</h4>
          <form onSubmit={handleSearch} className="query-form">
            <div className="input-with-icon">
              <Search size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search across indexed documents..."
                aria-label="Semantic search query"
              />
            </div>
            <button
              type="submit"
              className="action-btn-small"
              disabled={searching || !searchQuery.trim()}
            >
              {searching ? 'Querying...' : 'Search'}
            </button>
          </form>

          {/* Search Results List */}
          <div className="search-results-list">
            {searchResults.length === 0 ? (
              <p className="empty-subtext">No query run yet. Type a question or topic above to retrieve context.</p>
            ) : (
              searchResults.map((result, idx) => (
                <div key={idx} className="result-chunk-card">
                  <div className="result-chunk-header">
                    <span className="source-name">
                      <FileText size={13} />
                      {result.document.metadata?.filename || `Document ${result.document.id.slice(0, 8)}`}
                    </span>
                    <span className="similarity-badge">
                      Score: {(result.score * 100).toFixed(1)}%
                    </span>
                  </div>
                  <p className="chunk-content-preview">{result.document.content}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Upload and Document Management */}
        <div className="bay-subcard">
          <h4>Ingest Local Knowledge</h4>
          <label className="upload-dropzone">
            <UploadCloud size={28} className="upload-icon" />
            <span className="upload-title">
              {uploading ? 'Processing document...' : 'Upload PDF Document'}
            </span>
            <span className="upload-desc">
              Automatic chunking, embedding, and provenance indexing
            </span>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              disabled={uploading}
              style={{ display: 'none' }}
            />
          </label>

          {uploadStatus && (
            <div className="upload-status-alert">
              <Plus size={14} />
              <span>{uploadStatus}</span>
            </div>
          )}

          <div className="bay-actions-footer">
            <button
              type="button"
              className="danger-btn-quiet"
              onClick={handleClearRag}
            >
              <Trash2 size={14} />
              Clear Vector Database
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
