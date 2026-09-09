'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AlertOctagon, AlertTriangle, Check, Copy, RefreshCw, ShieldAlert, X } from 'lucide-react';
import { AppError } from '@/lib/types';
import { pulseErrorHologram } from '@/lib/animations';

interface ErrorDiagnosticModalProps {
  error: AppError | null;
  onDismiss: () => void;
  onRetry?: () => void;
}

export default function ErrorDiagnosticModal({
  error,
  onDismiss,
  onRetry,
}: ErrorDiagnosticModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    if (error && modalRef.current) {
      pulseErrorHologram(modalRef.current);
    }
  }, [error]);

  if (!error) return null;

  const copyDiagnostic = () => {
    const payload = JSON.stringify(error, null, 2);
    navigator.clipboard.writeText(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isFatal = error.severity === 'fatal';
  const isPolicy = error.code === 'POLICY_VIOLATION';

  return (
    <div
      className="error-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="diagnostic-title"
    >
      <div className="error-modal-card" ref={modalRef}>
        <div className="error-modal-header">
          <div className="error-badge-row">
            <span className={`error-severity-pill ${error.severity}`}>
              {isPolicy ? <ShieldAlert size={15} /> : isFatal ? <AlertOctagon size={15} /> : <AlertTriangle size={15} />}
              {error.code}
            </span>
            <span className="error-timestamp">{new Date(error.timestamp).toLocaleTimeString()}</span>
          </div>
          <button
            className="error-close-btn"
            onClick={onDismiss}
            aria-label="Close error diagnostic"
          >
            <X size={18} />
          </button>
        </div>

        <div className="error-modal-body">
          <h3 id="diagnostic-title" className="error-headline">
            {error.message}
          </h3>

          {error.suggestedAction && (
            <div className="error-suggested-action">
              <span className="action-tag">RECOMMENDED RESOLUTION</span>
              <p>{error.suggestedAction}</p>
            </div>
          )}

          {error.details && (
            <div className="error-details-box">
              <span className="details-tag">TRACE CONTEXT</span>
              <code>{error.details}</code>
            </div>
          )}

          {error.raw && (
            <div className="error-raw-section">
              <button
                type="button"
                className="toggle-raw-btn"
                onClick={() => setShowRaw(!showRaw)}
              >
                {showRaw ? 'Hide Raw Telemetry Payload' : 'View Raw Telemetry Payload'}
              </button>
              {showRaw && (
                <pre className="raw-payload-pre">
                  {JSON.stringify(error.raw, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>

        <div className="error-modal-actions">
          <button
            type="button"
            className="diagnostic-btn secondary"
            onClick={copyDiagnostic}
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? 'Copied Trace' : 'Copy Trace'}
          </button>

          {onRetry && (
            <button
              type="button"
              className="diagnostic-btn primary"
              onClick={() => {
                onDismiss();
                onRetry();
              }}
            >
              <RefreshCw size={15} />
              Retry Mission
            </button>
          )}

          <button
            type="button"
            className="diagnostic-btn quiet"
            onClick={onDismiss}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
