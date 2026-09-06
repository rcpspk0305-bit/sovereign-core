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
    <div className="flex flex-col gap-5 max-w-7xl mx-auto p-4 sm:p-6 font-sans">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
            AI Flight Recorder & Blackbox Telemetry
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Real-time forensic auditing, reasoning trace, tool execution, and evidence provenance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchRecords()}
            disabled={loadingHistory}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 transition-colors disabled:opacity-50"
            title="Refresh history"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
            Refresh History
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
        <div className="lg:col-span-1 rounded-xl bg-zinc-900/40 border border-zinc-800/80 p-3.5 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Recorded Flights
            </span>
            <span className="text-[11px] text-zinc-500 font-mono">
              {recordsHistory.length} total
            </span>
          </div>

          <div className="flex flex-col gap-1.5 max-h-[520px] overflow-y-auto pr-1">
            {recordsHistory.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500">
                No flight records stored.
              </div>
            ) : (
              recordsHistory.map((rec) => {
                const isSelected = currentRecord?.task_id === rec.task_id;
                return (
                  <button
                    key={rec.task_id}
                    onClick={() => setCurrentRecord(rec)}
                    className={`w-full text-left p-2.5 rounded-lg border transition-all text-xs flex flex-col gap-1 ${
                      isSelected
                        ? 'bg-blue-950/30 border-blue-800 text-zinc-100 shadow-sm'
                        : 'bg-zinc-950/40 border-zinc-900 hover:bg-zinc-800/50 text-zinc-400'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono font-semibold truncate max-w-[110px]">
                        {rec.task_id}
                      </span>
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                        {rec.approval_status}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-400 line-clamp-1">
                      {rec.prompt || 'Untitled mission'}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono pt-1">
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
        <div className="lg:col-span-3 rounded-xl bg-zinc-900/40 border border-zinc-800/80 p-4 flex flex-col gap-4">
          {/* Tabs Bar */}
          <div className="flex items-center gap-1 border-b border-zinc-800 pb-2 overflow-x-auto">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const hasErrors = tab.id === 'errors' && (tab.count || 0) > 0;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : hasErrors
                      ? 'text-rose-400 hover:bg-zinc-800'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                  }`}
                >
                  {tab.id === 'steps' && <Activity className="w-3.5 h-3.5" />}
                  {tab.id === 'tools' && <Wrench className="w-3.5 h-3.5" />}
                  {tab.id === 'sources' && <Database className="w-3.5 h-3.5" />}
                  {tab.id === 'artifacts' && <FileCode className="w-3.5 h-3.5" />}
                  {tab.id === 'errors' && <AlertTriangle className="w-3.5 h-3.5" />}
                  {tab.id === 'raw_stream' && <Terminal className="w-3.5 h-3.5" />}
                  <span>{tab.label}</span>
                  {tab.count !== undefined && tab.count > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        isActive
                          ? 'bg-blue-700 text-white'
                          : hasErrors
                          ? 'bg-rose-950 text-rose-300'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
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
