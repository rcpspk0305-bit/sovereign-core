'use client';

import React, { useRef, useState } from 'react';
import { api } from '@/lib/api-client';
import { SearchResult } from '@/lib/types';
import { FileUp, FileText, Plus, Search, Tag } from 'lucide-react';

export default function RagView() {
  const [activeIngestTab, setActiveIngestTab] = useState<'pdf' | 'text'>('pdf');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docContent, setDocContent] = useState('');
  const [docId, setDocId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePdfUpload = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setStatusMessage(null);
    try {
      const res = await api.uploadPdf(selectedFile);
      setStatusMessage(
        `Successfully indexed "${res.filename}" (${res.total_pages} pages, ${res.total_chunks} chunks)`
      );
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (e: any) {
      setStatusMessage(`Upload failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTextIngest = async () => {
    if (!docContent.trim()) return;
    setLoading(true);
    setStatusMessage(null);
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
    setStatusMessage(null);
    try {
      const res = await api.searchRag(searchQuery.trim(), 4);
      setResults(res);
      setStatusMessage(`Found ${res.length} matching chunks.`);
    } catch (e: any) {
      setStatusMessage(`Search failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="workbench" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="workbench-title"><div className="eyebrow">Knowledge operations</div>
        <h2 style={{ fontSize: '18px', fontWeight: 600 }}>RAG Knowledge</h2>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Ingest local PDF documentation and text chunks with ChromaDB vector search and citations.
        </p>
      </div>

      {statusMessage && (
        <div
          className={statusMessage.includes('failed') ? 'badge badge-error' : 'badge badge-success'}
          style={{ alignSelf: 'flex-start' }}
        >
          {statusMessage}
        </div>
      )}

      <div className="two-column">
        {/* Ingestion Panel */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={16} color="var(--accent-cyan)" />
              <span>Document Ingestion</span>
            </h3>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                className={`btn ${activeIngestTab === 'pdf' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 10px', fontSize: '12px' }}
                onClick={() => setActiveIngestTab('pdf')}
              >
                PDF Upload
              </button>
              <button
                className={`btn ${activeIngestTab === 'text' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 10px', fontSize: '12px' }}
                onClick={() => setActiveIngestTab('text')}
              >
                Raw Text
              </button>
            </div>
          </div>

          {activeIngestTab === 'pdf' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div
                style={{
                  border: '2px dashed var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '24px 16px',
                  textAlign: 'center',
                  background: 'var(--bg-tertiary)',
                  cursor: 'pointer',
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <FileUp size={28} color="var(--accent-cyan)" style={{ margin: '0 auto 8px' }} />
                <p style={{ fontSize: '13px', fontWeight: 500 }}>
                  {selectedFile ? selectedFile.name : 'Select or drop a PDF document'}
                </p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Parsed via PyMuPDF with page-level citation metadata
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedFile(e.target.files[0]);
                    }
                  }}
                />
              </div>
              <button
                className="btn btn-primary"
                onClick={handlePdfUpload}
                disabled={loading || !selectedFile}
              >
                {loading ? 'Processing & Indexing...' : 'Index PDF Document'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                onClick={handleTextIngest}
                disabled={loading || !docContent.trim()}
              >
                {loading ? 'Indexing...' : 'Index Text'}
              </button>
            </div>
          )}
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

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              marginTop: '8px',
              maxHeight: '340px',
              overflowY: 'auto',
            }}
          >
            {results.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                No search results to display yet.
              </div>
            ) : (
              results.map((r, idx) => {
                const docName = r.document.metadata?.document_name;
                const pageNum = r.document.metadata?.page_number;
                const source = r.document.metadata?.source;

                return (
                  <div
                    key={idx}
                    style={{
                      padding: '12px',
                      borderRadius: '6px',
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {docName && pageNum ? (
                          <span
                            className="badge badge-success"
                            style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <FileText size={10} />
                            <span>{docName} (Page {pageNum})</span>
                          </span>
                        ) : source ? (
                          <span className="badge badge-success" style={{ fontSize: '11px' }}>
                            {source}
                          </span>
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            ID: {r.document.id}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                        Score: {(r.score * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', lineHeight: '1.4', color: 'var(--text-primary)' }}>
                      {r.document.content}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
