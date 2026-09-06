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
      <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
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
              style={{
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(15, 23, 42, 0.75)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                backdropFilter: 'blur(10px)',
              }}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <FileCheck size={18} color="var(--accent-emerald)" />
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{art.title}</span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(99, 102, 241, 0.15)',
                      color: 'var(--accent-indigo)',
                      border: '1px solid rgba(99, 102, 241, 0.3)',
                    }}
                  >
                    {art.artifact_type}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {docxPath && (
                    <button
                      onClick={() => handleDownloadDocx(docxPath, docxName)}
                      className="btn"
                      style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        background: 'linear-gradient(135deg, var(--accent-emerald), #059669)',
                        color: '#ffffff',
                        boxShadow: '0 0 12px var(--accent-emerald-glow)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Download size={14} />
                      Download DOCX
                    </button>
                  )}
                  <button
                    onClick={() => handleCopy(art.artifact_id, art.content)}
                    className="btn btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                  >
                    {copiedId === art.artifact_id ? (
                      <>
                        <Check size={14} color="var(--accent-emerald)" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy size={14} /> Copy Text
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Claims Validation Badge if Approval Note */}
              {valStatus && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'rgba(3, 7, 18, 0.7)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '12px',
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Claims Validation:</span>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      backgroundColor: valStatus === 'PASSED' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      color: valStatus === 'PASSED' ? 'var(--accent-emerald)' : 'var(--accent-amber)',
                      border: valStatus === 'PASSED' ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(245, 158, 11, 0.35)',
                      boxShadow: valStatus === 'PASSED' ? '0 0 10px var(--accent-emerald-glow)' : '0 0 10px var(--accent-amber-glow)',
                    }}
                  >
                    {valStatus === 'PASSED' ? (
                      <ShieldCheck size={14} />
                    ) : (
                      <ShieldAlert size={14} />
                    )}
                    {valStatus}
                  </span>
                  {verifiedCount !== undefined && (
                    <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '11px' }}>
                      Verified: <strong style={{ color: 'var(--accent-emerald)' }}>{verifiedCount}</strong>
                    </span>
                  )}
                  {unsupportedCount !== undefined && unsupportedCount > 0 && (
                    <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '11px' }}>
                      Unsupported: <strong style={{ color: 'var(--accent-amber)' }}>{unsupportedCount}</strong>
                    </span>
                  )}
                </div>
              )}

              {/* Artifact Content Preview */}
              <div
                style={{
                  backgroundColor: 'rgba(3, 7, 18, 0.85)',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  color: '#cbd5e1',
                  maxHeight: '260px',
                  overflowY: 'auto',
                  lineHeight: 1.6,
                }}
              >
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{art.content}</pre>
              </div>

              {/* SHA256 Checksum & Metadata */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  paddingTop: '8px',
                  borderTop: '1px solid var(--border-subtle)',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  color: 'var(--text-muted)',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }} className="truncate" title={art.checksum_sha256}>
                  <Hash size={13} color="var(--accent-cyan)" className="shrink-0" />
                  SHA256: <strong style={{ color: 'var(--text-secondary)' }}>{art.checksum_sha256}</strong>
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
