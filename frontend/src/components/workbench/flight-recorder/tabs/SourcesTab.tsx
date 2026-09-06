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
      <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
        Retrieved Document Evidence ({retrievedSources.length})
      </span>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {retrievedSources.map((source, idx) => (
          <div
            key={idx}
            className="p-3.5 rounded-lg bg-zinc-900/50 border border-zinc-800/80 flex flex-col gap-2 hover:border-zinc-700 transition-colors"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5 truncate">
                <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                {source.document_name}
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-950/40 text-blue-300 border border-blue-800/50">
                Score: {source.similarity_score.toFixed(3)}
              </span>
            </div>

            <div className="bg-zinc-950/70 p-2.5 rounded border border-zinc-900 text-xs text-zinc-300 font-sans leading-relaxed max-h-36 overflow-y-auto">
              {source.chunk_preview}
            </div>

            {source.metadata && (
              <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
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
