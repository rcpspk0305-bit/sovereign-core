'use client';

import React from 'react';
import { RetrievedSource } from '@/lib/types';
import { Database, FileText } from 'lucide-react';

interface SourcesTabProps {
  retrievedSources: RetrievedSource[];
}

export function SourcesTab({ retrievedSources }: SourcesTabProps) {
  if (retrievedSources.length === 0) {
    return (
      <div className="py-12 text-center text-zinc-500 text-sm flex flex-col items-center gap-2">
        <Database className="w-8 h-8 opacity-30 text-zinc-400" />
        <span>No knowledge base sources retrieved during this mission.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
        Retrieved Document Evidence ({retrievedSources.length})
      </span>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {retrievedSources.map((source, idx) => (
          <div
            key={idx}
            style={{
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(15, 23, 42, 0.75)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              backdropFilter: 'blur(8px)',
              transition: 'all 0.2s ease',
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }} className="truncate">
                <FileText size={15} color="var(--accent-cyan)" className="shrink-0" />
                {source.document_name}
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(0, 240, 255, 0.12)',
                  color: 'var(--accent-cyan)',
                  border: '1px solid rgba(0, 240, 255, 0.3)',
                  boxShadow: '0 0 8px var(--accent-cyan-glow)',
                }}
              >
                Score: {source.similarity_score.toFixed(3)}
              </span>
            </div>

            <div
              style={{
                backgroundColor: 'rgba(3, 7, 18, 0.75)',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                fontSize: '12px',
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
                maxHeight: '140px',
                overflowY: 'auto',
              }}
            >
              {source.chunk_preview}
            </div>

            {source.metadata && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                {source.page_number && <span>Page {source.page_number}</span>}
                {source.metadata.chunk_index !== undefined && (
                  <span>Chunk #{source.metadata.chunk_index}</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
