'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  FileCheck,
  Layers,
  Radar,
  Radio,
  RefreshCw,
  Shield,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { api, normalizeError } from '@/lib/api-client';
import { AppError, ApprovalStatus, FlightEvent, FlightRecord } from '@/lib/types';
import { apply3DTilt, reset3DTilt } from '@/lib/animations';

interface FlightRecorderBayProps {
  onError: (error: AppError) => void;
  selectedTaskId?: string | null;
}

export default function FlightRecorderBay({ onError, selectedTaskId }: FlightRecorderBayProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [records, setRecords] = useState<FlightRecord[]>([]);
  const [activeRecord, setActiveRecord] = useState<FlightRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [liveEvents, setLiveEvents] = useState<FlightEvent[]>([]);
  const [wsConnected, setWsConnected] = useState(false);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const data = await api.getFlightRecords(20);
      setRecords(data);
      if (data.length > 0) {
        if (selectedTaskId) {
          const matched = data.find((r) => r.task_id === selectedTaskId);
          setActiveRecord(matched || data[0]);
        } else if (!activeRecord) {
          setActiveRecord(data[0]);
        }
      }
    } catch (err) {
      onError(normalizeError(err, 'VALIDATION_ERROR'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [selectedTaskId]);

  // Subscribe to live WebSocket flight telemetry
  useEffect(() => {
    const unsubscribe = api.subscribeToFlightTelemetry(
      activeRecord?.task_id,
      (event: FlightEvent) => {
        setWsConnected(true);
        setLiveEvents((prev) => [event, ...prev.slice(0, 19)]);
      },
      () => setWsConnected(false),
    );

    return () => unsubscribe();
  }, [activeRecord?.task_id]);

  const handleApproval = async (status: ApprovalStatus) => {
    if (!activeRecord) return;
    try {
      const updated = await api.updateFlightApproval(activeRecord.task_id, status);
      setActiveRecord(updated);
      setRecords((prev) => prev.map((r) => (r.task_id === updated.task_id ? updated : r)));
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
          <Radar className="bay-icon" size={20} />
          <div>
            <h3>Durable Flight Recorder & Audit Telemetry</h3>
            <p>Cryptographically verifiable mission telemetry, source provenance, and air-gap approvals.</p>
          </div>
        </div>

        <div className="bay-stats-cluster">
          <div className="stat-pill">
            <Radio size={14} className={wsConnected ? 'online-pulse' : 'offline-pulse'} />
            <span>TELEMETRY FEED</span>
            <strong>{wsConnected ? 'STREAMING' : 'IDLE'}</strong>
          </div>
          <button
            type="button"
            className="stat-refresh-btn"
            onClick={fetchRecords}
            disabled={loading}
            aria-label="Refresh flight records"
          >
            <RefreshCw size={14} className={loading ? 'spin-icon' : ''} />
          </button>
        </div>
      </div>

      <div className="bay-content-grid">
        {/* Missions list */}
        <div className="bay-subcard">
          <h4>Recorded Mission Sessions</h4>
          <div className="flight-records-list">
            {records.length === 0 ? (
              <p className="empty-subtext">No flight records logged yet. Run a mission from Mission Control.</p>
            ) : (
              records.map((rec) => (
                <button
                  key={rec.task_id}
                  type="button"
                  className={`flight-record-item ${activeRecord?.task_id === rec.task_id ? 'active' : ''}`}
                  onClick={() => setActiveRecord(rec)}
                >
                  <div className="record-item-top">
                    <span className="task-id-text">Task {rec.task_id.slice(0, 8)}...</span>
                    <span className={`approval-pill ${rec.approval_status}`}>
                      {rec.approval_status}
                    </span>
                  </div>
                  <p className="record-prompt-preview">{rec.prompt}</p>
                  <div className="record-item-meta">
                    <span>{rec.model}</span>
                    <span>{rec.total_latency_ms ? `${(rec.total_latency_ms / 1000).toFixed(1)}s` : 'active'}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Selected Record Telemetry Details */}
        <div className="bay-subcard">
          {activeRecord ? (
            <div className="record-detail-container">
              <div className="record-detail-header">
                <div>
                  <h4>Mission: {activeRecord.task_id.slice(0, 12)}</h4>
                  <p className="record-time-text">
                    Started: {new Date(activeRecord.start_time).toLocaleString()}
                  </p>
                </div>

                {/* Approval Action Controls */}
                <div className="approval-controls">
                  <button
                    type="button"
                    className="approve-btn"
                    onClick={() => handleApproval('APPROVED')}
                  >
                    <CheckCircle2 size={14} />
                    Approve
                  </button>
                  <button
                    type="button"
                    className="reject-btn"
                    onClick={() => handleApproval('REJECTED')}
                  >
                    <XCircle size={14} />
                    Reject
                  </button>
                </div>
              </div>

              {/* Status Meta Cards */}
              <div className="telemetry-badges-row">
                <div className="telemetry-chip">
                  <span>AIR-GAP MODE</span>
                  <strong>{activeRecord.network_mode}</strong>
                </div>
                <div className="telemetry-chip">
                  <span>EXECUTION STATUS</span>
                  <strong className={activeRecord.status}>{activeRecord.status.toUpperCase()}</strong>
                </div>
                <div className="telemetry-chip">
                  <span>LATENCY</span>
                  <strong>{activeRecord.total_latency_ms ? `${activeRecord.total_latency_ms} ms` : 'N/A'}</strong>
                </div>
              </div>

              {/* Retrieved Provenance Sources */}
              {activeRecord.retrieved_sources?.length > 0 && (
                <div className="record-section">
                  <h5>
                    <FileCheck size={14} />
                    PROVENANCE SOURCES ({activeRecord.retrieved_sources.length})
                  </h5>
                  <div className="sources-list">
                    {activeRecord.retrieved_sources.map((src, i) => (
                      <div key={i} className="source-pill">
                        <strong>{src.document_name}</strong>
                        {src.page_number && <span>p.{src.page_number}</span>}
                        <span>{(src.similarity_score * 100).toFixed(0)}% match</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recorded Errors */}
              {activeRecord.errors?.length > 0 && (
                <div className="record-section">
                  <h5 className="error-section-title">
                    <AlertTriangle size={14} />
                    RECORDED ERRORS ({activeRecord.errors.length})
                  </h5>
                  <div className="errors-list">
                    {activeRecord.errors.map((err, i) => (
                      <div key={i} className={`error-log-card ${err.severity}`}>
                        <span className="error-log-sev">[{err.severity.toUpperCase()}]</span>
                        <p>{err.error_message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Steps Trace */}
              <div className="record-section">
                <h5>
                  <Layers size={14} />
                  STEPS EXECUTED ({activeRecord.steps?.length || 0})
                </h5>
                <div className="steps-scroll-tray">
                  {activeRecord.steps?.map((step, idx) => (
                    <div key={idx} className="step-trace-card">
                      <span className="step-idx">#{step.step_number}</span>
                      <p>{step.thought || step.observation || 'Step executed.'}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="empty-subtext">Select a mission record from the list to view its black-box flight telemetry.</p>
          )}
        </div>
      </div>
    </div>
  );
}
