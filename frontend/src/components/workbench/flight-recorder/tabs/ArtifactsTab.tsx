'use client';

import React, { useState } from 'react';
import { GeneratedArtifact } from '@/lib/types';
import { api } from '@/lib/api-client';
import { Check, Copy, Download, FileCheck, FileCode, Hash, ShieldCheck, ShieldAlert } from 'lucide-react';

interface ArtifactsTabProps {
  artifacts: GeneratedArtifact[];
}

export function ArtifactsTab({ artifacts }: ArtifactsTabProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (id: string, text: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        window.prompt('Copy Content:', text);
      }
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      window.prompt('Copy Content:', text);
    }
  };

  const handleDownloadDocx = (docxPath?: string, docxName?: string) => {
    if (!docxPath) return;
    const url = api.getApprovalNoteDownloadUrl(docxPath);
    window.open(url, '_blank');
  };

  if (artifacts.length === 0) {
    return (
      <div className="py-12 text-center text-zinc-500 text-sm flex flex-col items-center gap-2">
        <FileCode className="w-8 h-8 opacity-30 text-zinc-400" />
        <span>No artifacts or approval notes produced during this mission.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
        Generated Forensic Artifacts ({artifacts.length})
      </span>

      <div className="flex flex-col gap-4">
        {artifacts.map((art) => {
          const docxPath = art.metadata?.docx_file_path;
          const docxName = art.metadata?.docx_file_name;
          const valStatus = art.metadata?.validation_status;
          const verifiedCount = art.metadata?.verified_claims_count;
          const unsupportedCount = art.metadata?.unsupported_claims_count;

          return (
            <div
              key={art.artifact_id}
              className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-semibold text-zinc-100">{art.title}</span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                    {art.artifact_type}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {docxPath && (
                    <button
                      onClick={() => handleDownloadDocx(docxPath, docxName)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download DOCX
                    </button>
                  )}
                  <button
                    onClick={() => handleCopy(art.artifact_id, art.content)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                  >
                    {copiedId === art.artifact_id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copy Text
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Claims Validation Badge if Approval Note */}
              {valStatus && (
                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/60 text-xs flex-wrap">
                  <span className="text-zinc-400 font-medium">Claims Validation:</span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-medium ${
                      valStatus === 'PASSED'
                        ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/60'
                        : 'bg-amber-950/40 text-amber-400 border border-amber-800/60'
                    }`}
                  >
                    {valStatus === 'PASSED' ? (
                      <ShieldCheck className="w-3.5 h-3.5" />
                    ) : (
                      <ShieldAlert className="w-3.5 h-3.5" />
                    )}
                    {valStatus}
                  </span>
                  {verifiedCount !== undefined && (
                    <span className="text-zinc-400 font-mono text-[11px]">
                      Verified: <strong className="text-emerald-400">{verifiedCount}</strong>
                    </span>
                  )}
                  {unsupportedCount !== undefined && unsupportedCount > 0 && (
                    <span className="text-zinc-400 font-mono text-[11px]">
                      Unsupported: <strong className="text-amber-400">{unsupportedCount}</strong>
                    </span>
                  )}
                </div>
              )}

              {/* Artifact Content Preview */}
              <div className="bg-zinc-950/80 p-3 rounded-lg border border-zinc-900 text-xs font-mono text-zinc-300 max-h-64 overflow-y-auto leading-relaxed">
                <pre className="whitespace-pre-wrap">{art.content}</pre>
              </div>

              {/* SHA256 Checksum & Metadata */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-zinc-800/60 text-[11px] font-mono text-zinc-500">
                <span className="flex items-center gap-1 truncate" title={art.checksum_sha256}>
                  <Hash className="w-3 h-3 text-zinc-400 shrink-0" />
                  SHA256: <strong className="text-zinc-400">{art.checksum_sha256}</strong>
                </span>
                <span>{new Date(art.timestamp).toLocaleString()}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
