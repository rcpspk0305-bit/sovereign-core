'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api-client';
import {
  ApprovalStatus,
  FlightEvent,
  FlightRecord,
  GeneratedArtifact,
  NetworkMode,
  RecordedError,
  RetrievedSource,
  ToolExecutionRecord,
} from '@/lib/types';
import {
  Activity,
  AlertTriangle,
  Clock,
  Database,
  FileCode,
  Layers,
  RefreshCw,
  Terminal,
  Wrench,
} from 'lucide-react';

import { FlightRecorderTab, TabItem } from './flight-recorder/types';
import { TelemetryStatusRibbon } from './flight-recorder/TelemetryStatusRibbon';
import { MissionDispatcher } from './flight-recorder/MissionDispatcher';
import { StepsTab } from './flight-recorder/tabs/StepsTab';
import { ToolsTab } from './flight-recorder/tabs/ToolsTab';
import { SourcesTab } from './flight-recorder/tabs/SourcesTab';
import { ArtifactsTab } from './flight-recorder/tabs/ArtifactsTab';
import { ErrorsTab } from './flight-recorder/tabs/ErrorsTab';
import { RawStreamTab } from './flight-recorder/tabs/RawStreamTab';

interface FlightRecorderViewProps {
  model: string;
}

export default function FlightRecorderView({ model }: FlightRecorderViewProps) {
  const [prompt, setPrompt] = useState<string>(
    'Retrieve document details about Apollo99, calculate (82 - 75) temperature delta, and generate an inspection report with citations.'
  );
  const [networkMode, setNetworkMode] = useState<NetworkMode>('AIR_GAPPED_LOCAL');
  const [maxSteps, setMaxSteps] = useState<number>(5);
  const [running, setRunning] = useState<boolean>(false);

  // Active record state & history
  const [currentRecord, setCurrentRecord] = useState<FlightRecord | null>(null);
  const [recordsHistory, setRecordsHistory] = useState<FlightRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  // Live WebSocket state & event stream
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [rawEvents, setRawEvents] = useState<FlightEvent[]>([]);
  const [activeTab, setActiveTab] = useState<FlightRecorderTab>('steps');

  const wsRef = useRef<WebSocket | null>(null);

  // Ref to hold the current event handler, preventing stale closures in the WebSocket listener
  const handleIncomingEventRef = useRef<(event: FlightEvent) => void>(() => {});

  // Load history on mount
  const fetchRecords = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const list = await api.getFlightRecords(20);
      setRecordsHistory(list);
      if (list.length > 0) {
        setCurrentRecord((prev) => prev || list[0]);
      }
    } catch (err) {
      console.warn('Could not load flight records history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Event handler for live streaming events
  const handleIncomingFlightEvent = useCallback((flightEvent: FlightEvent) => {
    setRawEvents((prev) => [...prev.slice(-199), flightEvent]);

    const { event_type, data, task_id } = flightEvent;

    if (event_type === 'task_started') {
      setRunning(true);
      setCurrentRecord({
        task_id,
        model: data.model || model,
        prompt: data.prompt || '',
        network_mode: data.network_mode || 'AIR_GAPPED_LOCAL',
        approval_status: data.approval_status || 'PENDING',
        status: 'running',
        start_time: data.start_time || new Date().toISOString(),
        steps: [],
        tools_called: [],
        retrieved_sources: [],
        artifacts_generated: [],
        errors: [],
        metadata: {},
      });
    } else if (event_type === 'step_started') {
      setCurrentRecord((prev) => {
        if (!prev) return prev;
        const exists = prev.steps.some((s) => s.step_number === data.step_number);
        if (exists) return prev;
        return {
          ...prev,
          steps: [
            ...prev.steps,
            {
              step_number: data.step_number,
              thought: data.thought || '',
              timestamp: flightEvent.timestamp,
              status: 'running',
            },
          ],
        };
      });
    } else if (event_type === 'tool_completed') {
      const toolRec: ToolExecutionRecord = {
        step_number: data.step_number,
        tool_name: data.tool_name,
        tool_arguments: data.tool_arguments || {},
        execution_time_ms: data.execution_time_ms || 0,
        success: data.success ?? true,
        error: data.error,
        output_preview: data.output_preview,
      };
      setCurrentRecord((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          tools_called: [...prev.tools_called, toolRec],
        };
      });
    } else if (event_type === 'sources_retrieved') {
      const newSources: RetrievedSource[] = (data.sources || []).map((s: any) => ({
        document_name: s.document_name,
        page_number: s.page_number,
        similarity_score: s.similarity_score,
        chunk_preview: s.chunk_preview,
        metadata: s.metadata,
      }));
      setCurrentRecord((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          retrieved_sources: [...prev.retrieved_sources, ...newSources],
        };
      });
    } else if (event_type === 'artifact_generated') {
      const artifact: GeneratedArtifact = {
        artifact_id: data.artifact_id,
        artifact_type: data.artifact_type,
        title: data.title,
        content: data.content,
        checksum_sha256: data.checksum_sha256,
        timestamp: data.timestamp,
        metadata: data.metadata,
      };
      setCurrentRecord((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          artifacts_generated: [...prev.artifacts_generated, artifact],
        };
      });
    } else if (event_type === 'error_recorded') {
      const errorRec: RecordedError = {
        step_number: data.step_number,
        error_message: data.error_message || 'Error occurred',
        severity: data.severity || 'error',
        timestamp: flightEvent.timestamp,
      };
      setCurrentRecord((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          errors: [...prev.errors, errorRec],
        };
      });
    } else if (event_type === 'task_completed') {
      setRunning(false);
      setCurrentRecord((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: data.status || 'completed',
          approval_status: data.approval_status || prev.approval_status,
          total_latency_ms: data.total_latency_ms,
          final_response: data.final_response,
        };
      });
      fetchRecords();
    } else if (event_type === 'approval_updated') {
      setCurrentRecord((prev) => {
        if (!prev || prev.task_id !== task_id) return prev;
        return {
          ...prev,
          approval_status: data.approval_status,
          metadata: {
            ...prev.metadata,
            approval_notes: data.notes,
          },
        };
      });
      fetchRecords();
    }
  }, [fetchRecords, model]);

  // Keep ref up to date
  useEffect(() => {
    handleIncomingEventRef.current = handleIncomingFlightEvent;
  }, [handleIncomingFlightEvent]);

  // WebSocket lifecycle management
  useEffect(() => {
    const wsUrl = api.getWebSocketUrl();
    let socket: WebSocket | null = null;
    let reconnectTimeout: any = null;
    let isDisposed = false;

    const connectWs = () => {
      try {
        socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onopen = () => {
          if (isDisposed) return;
          setWsConnected(true);
        };

        socket.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            if (parsed.event_type) {
              handleIncomingEventRef.current(parsed);
            }
          } catch {
            // Ignore non-JSON heartbeat frames
          }
        };

        socket.onclose = () => {
          if (isDisposed) return;
          setWsConnected(false);
          reconnectTimeout = setTimeout(connectWs, 3000);
        };

        socket.onerror = () => {
          if (isDisposed) return;
          setWsConnected(false);
        };
      } catch (err) {
        console.warn('WebSocket connection attempt failed:', err);
        if (!isDisposed) {
          reconnectTimeout = setTimeout(connectWs, 3000);
        }
      }
    };

    connectWs();

    return () => {
      isDisposed = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (socket) {
        socket.close();
      }
    };
  }, []);

  // Dispatch mission
  const handleRunMission = async () => {
    if (!prompt.trim() || running) return;
    setRunning(true);
    setRawEvents([]);

    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        // Fast streaming mode via WebSocket
        wsRef.current.send(
          JSON.stringify({
            action: 'run_mission',
            prompt,
            model: model || undefined,
            network_mode: networkMode,
            max_steps: maxSteps,
          })
        );
        // Fallback REST execution
        const res = await api.runFlightMission(
          prompt,
          model || undefined,
          networkMode,
          undefined,
          maxSteps
        );
        setCurrentRecord(res);
        setRunning(false);
        fetchRecords();
      }
    } catch (err: any) {
      console.error('Mission launch failed:', err);
      setRunning(false);
      setCurrentRecord((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: 'failed',
          approval_status: 'FAILED',
          errors: [
            ...prev.errors,
            {
              error_message: String(err?.message || err),
              severity: 'error',
              timestamp: new Date().toISOString(),
            },
          ],
        };
      });
    }
  };

  // Update human approval
  const handleUpdateApproval = async (newStatus: ApprovalStatus, notes?: string) => {
    if (!currentRecord?.task_id) return;
    try {
      const updated = await api.updateFlightApproval(currentRecord.task_id, newStatus, notes);
      setCurrentRecord(updated);
      fetchRecords();
    } catch (err) {
      console.error('Failed to update approval:', err);
    }
  };

  // Tab definitions with dynamic counts
  const tabs: TabItem[] = [
    { id: 'steps', label: 'Execution Steps', count: currentRecord?.steps.length || 0 },
    { id: 'tools', label: 'Tools Called', count: currentRecord?.tools_called.length || 0 },
    { id: 'sources', label: 'Retrieved Sources', count: currentRecord?.retrieved_sources.length || 0 },
    { id: 'artifacts', label: 'Artifacts', count: currentRecord?.artifacts_generated.length || 0 },
    { id: 'errors', label: 'Errors & Violations', count: currentRecord?.errors.length || 0 },
    { id: 'raw_stream', label: 'Blackbox Log', count: rawEvents.length },
  ];

  return (
    <div className="workbench" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. Header Banner */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div className="eyebrow">Mission observability</div><h1 style={{ fontSize: '25px', fontWeight: 700, letterSpacing: '-.04em', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px' }}>
            <span
              className="pulse-beacon"
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-cyan)',
                boxShadow: '0 0 12px var(--accent-cyan-glow)',
                display: 'inline-block',
              }}
            />
            Flight Recorder
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Real-time execution traces, tool telemetry, and evidence provenance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchRecords()}
            disabled={loadingHistory}
            className="btn btn-secondary"
            title="Refresh history"
            style={{ fontSize: '12px', padding: '6px 12px' }}
          >
            <RefreshCw size={13} className={loadingHistory ? 'spin' : ''} />
            Refresh Telemetry
          </button>
        </div>
      </div>

      {/* 2. Top Telemetry Status Ribbon */}
      <TelemetryStatusRibbon
        currentRecord={currentRecord}
        running={running}
        wsConnected={wsConnected}
        onUpdateApproval={handleUpdateApproval}
      />

      {/* 3. Mission Dispatcher Box */}
      <MissionDispatcher
        prompt={prompt}
        setPrompt={setPrompt}
        networkMode={networkMode}
        setNetworkMode={setNetworkMode}
        maxSteps={maxSteps}
        setMaxSteps={setMaxSteps}
        running={running}
        onRunMission={handleRunMission}
      />

      {/* 4. Main Body: History Sidebar + Tab Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 items-start">
        {/* Left: Mission History List */}
        <div
          style={{
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--space-card)',
            border: '1px solid var(--border-subtle)',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            backdropFilter: 'blur(10px)',
          }}
          className="lg:col-span-1"
        >
          <div className="flex items-center justify-between">
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
              Recorded Flights
            </span>
            <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--accent-cyan)' }}>
              {recordsHistory.length} total
            </span>
          </div>

          <div className="flex flex-col gap-1.5 max-h-[520px] overflow-y-auto pr-1">
            {recordsHistory.length === 0 ? (
              <div style={{ padding: '32px 0', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
                No flight records stored.
              </div>
            ) : (
              recordsHistory.map((rec) => {
                const isSelected = currentRecord?.task_id === rec.task_id;
                return (
                  <button
                    key={rec.task_id}
                    onClick={() => setCurrentRecord(rec)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: isSelected ? '1px solid var(--accent-cyan)' : '1px solid rgba(255, 255, 255, 0.05)',
                      backgroundColor: isSelected ? 'rgba(0, 240, 255, 0.1)' : 'rgba(3, 7, 18, 0.6)',
                      boxShadow: isSelected ? '0 0 12px var(--accent-cyan-glow)' : 'none',
                      color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '12px', color: isSelected ? 'var(--accent-cyan)' : 'var(--text-primary)' }} className="truncate max-w-[110px]">
                        {rec.task_id}
                      </span>
                      <span
                        style={{
                          fontSize: '10px',
                          textTransform: 'uppercase',
                          fontFamily: 'monospace',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(255, 255, 255, 0.06)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {rec.approval_status}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {rec.prompt || 'Untitled mission'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace', paddingTop: '2px' }}>
                      <span>{new Date(rec.start_time).toLocaleTimeString()}</span>
                      {rec.total_latency_ms && <span>{rec.total_latency_ms.toFixed(0)} ms</span>}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Tabbed Deep Evidence Explorer */}
        <div
          style={{
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--space-card)',
            border: '1px solid var(--border-subtle)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            backdropFilter: 'blur(12px)',
          }}
          className="lg:col-span-3"
        >
          {/* Tabs Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px', overflowX: 'auto' }}>
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const hasErrors = tab.id === 'errors' && (tab.count || 0) > 0;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    border: isActive
                      ? '1px solid var(--accent-cyan)'
                      : hasErrors
                      ? '1px solid rgba(244, 63, 94, 0.4)'
                      : '1px solid transparent',
                    background: isActive
                      ? 'linear-gradient(135deg, rgba(0, 240, 255, 0.2), rgba(99, 102, 241, 0.2))'
                      : 'transparent',
                    color: isActive
                      ? 'var(--accent-cyan)'
                      : hasErrors
                      ? 'var(--accent-rose)'
                      : 'var(--text-secondary)',
                    boxShadow: isActive ? '0 0 12px var(--accent-cyan-glow)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {tab.id === 'steps' && <Activity size={14} />}
                  {tab.id === 'tools' && <Wrench size={14} />}
                  {tab.id === 'sources' && <Database size={14} />}
                  {tab.id === 'artifacts' && <FileCode size={14} />}
                  {tab.id === 'errors' && <AlertTriangle size={14} />}
                  {tab.id === 'raw_stream' && <Terminal size={14} />}
                  <span>{tab.label}</span>
                  {tab.count !== undefined && tab.count > 0 && (
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '1px 6px',
                        borderRadius: '9999px',
                        fontFamily: 'monospace',
                        backgroundColor: isActive
                          ? 'rgba(0, 240, 255, 0.25)'
                          : hasErrors
                          ? 'rgba(244, 63, 94, 0.25)'
                          : 'rgba(255, 255, 255, 0.08)',
                        color: isActive
                          ? 'var(--accent-cyan)'
                          : hasErrors
                          ? 'var(--accent-rose)'
                          : 'var(--text-secondary)',
                      }}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Active Tab Panel */}
          <div className="pt-1">
            {activeTab === 'steps' && (
              <StepsTab
                steps={currentRecord?.steps || []}
                finalResponse={currentRecord?.final_response}
                running={running}
              />
            )}

            {activeTab === 'tools' && (
              <ToolsTab toolsCalled={currentRecord?.tools_called || []} />
            )}

            {activeTab === 'sources' && (
              <SourcesTab retrievedSources={currentRecord?.retrieved_sources || []} />
            )}

            {activeTab === 'artifacts' && (
              <ArtifactsTab artifacts={currentRecord?.artifacts_generated || []} />
            )}

            {activeTab === 'errors' && (
              <ErrorsTab errors={currentRecord?.errors || []} />
            )}

            {activeTab === 'raw_stream' && (
              <RawStreamTab
                rawEvents={rawEvents}
                onClearEvents={() => setRawEvents([])}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
