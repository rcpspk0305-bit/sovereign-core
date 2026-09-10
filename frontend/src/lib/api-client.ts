/**
 * Sovereign-Core Frontend API Client.
 */

import {
  AuditEvent,
  ChatMessage,
  HealthStatus,
  LLMResponse,
  ModelInfo,
  SearchResult,
  StreamChunk,
  ToolDefinition,
  ToolResult,
  AgentResult,
  Document,
  UploadResponse,
  FlightRecord,
  FlightEvent,
  ApprovalStatus,
  NetworkMode,
  AppError,
  ErrorCode,
  ErrorSeverity,
  SessionItem,
  CreateSessionRequest,
  VectorStoreHealth,
  MigrationResult,
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export function normalizeError(err: unknown, defaultCode: ErrorCode = 'UNKNOWN_ERROR'): AppError {
  const timestamp = new Date().toISOString();
  if (typeof err === 'object' && err !== null && 'code' in err && 'message' in err && 'severity' in err) {
    return err as AppError;
  }
  const rawMsg = err instanceof Error ? err.message : String(err);
  let code: ErrorCode = defaultCode;
  let severity: ErrorSeverity = 'error';
  let suggestedAction = 'Check node connectivity or retry the operation.';

  if (rawMsg.includes('Failed to fetch') || rawMsg.includes('NetworkError') || rawMsg.includes('connection error')) {
    code = 'NETWORK_OFFLINE';
    severity = 'fatal';
    suggestedAction = 'Ensure backend node at http://localhost:8000 is running and reachable.';
  } else if (rawMsg.toLowerCase().includes('ollama') || rawMsg.toLowerCase().includes('model')) {
    code = 'OLLAMA_DISCONNECTED';
    severity = 'error';
    suggestedAction = 'Ensure Ollama daemon is running locally on port 11434 with model downloaded.';
  } else if (rawMsg.toLowerCase().includes('abort') || rawMsg.toLowerCase().includes('cancelled')) {
    code = 'STREAM_ABORTED';
    severity = 'info';
    suggestedAction = 'Mission request was aborted by operator.';
  } else if (rawMsg.toLowerCase().includes('timeout')) {
    code = 'MISSION_TIMEOUT';
    severity = 'warning';
    suggestedAction = 'The inference request exceeded latency window. Try with lower max steps.';
  } else if (rawMsg.toLowerCase().includes('policy') || rawMsg.toLowerCase().includes('violation')) {
    code = 'POLICY_VIOLATION';
    severity = 'fatal';
    suggestedAction = 'Mission violated sovereign policy (e.g. attempted internet egress).';
  }

  return {
    code,
    message: rawMsg,
    severity,
    timestamp,
    suggestedAction,
    raw: err,
  };
}


class ApiClient {
  private base: string;

  constructor(baseUrl: string = API_BASE) {
    this.base = baseUrl.replace(/\/$/, '');
  }

  async getHealth(): Promise<HealthStatus> {
    const res = await fetch(`${this.base}/api/v1/health`);
    if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
    return res.json();
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const res = await fetch(`${this.base}/api/v1/models`);
      if (!res.ok) {
        return [{ id: 'gemma4:e2b', name: 'gemma4:e2b (Local Default)' }];
      }
      return await res.json();
    } catch {
      return [{ id: 'gemma4:e2b', name: 'gemma4:e2b (Local Default)' }];
    }
  }

  async sendChat(
    messages: ChatMessage[],
    model?: string,
    temperature?: number,
  ): Promise<LLMResponse> {
    const res = await fetch(`${this.base}/api/v1/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, model, temperature, stream: false }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Chat request failed');
    }
    return res.json();
  }

  async streamChat(
    messages: ChatMessage[],
    model: string | undefined,
    onChunk: (content: string) => void,
    onDone: () => void,
    onError: (err: string) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    try {
      const res = await fetch(`${this.base}/api/v1/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, model, stream: true }),
        signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`Streaming failed: ${res.statusText}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let isDoneCalled = false;

      while (true) {
        if (signal?.aborted) {
          reader.cancel();
          onError('Stream aborted by operator.');
          return;
        }

        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const rawJson = trimmed.slice(6);
            try {
              const parsed: StreamChunk & { error?: string } = JSON.parse(rawJson);
              if (parsed.error) {
                onError(parsed.error);
                return;
              }
              if (parsed.content) onChunk(parsed.content);
              if (parsed.done && !isDoneCalled) {
                isDoneCalled = true;
                onDone();
                return;
              }
            } catch (e) {
              // Ignore partial JSON
            }
          }
        }
      }
      if (!isDoneCalled) {
        isDoneCalled = true;
        onDone();
      }
    } catch (err: any) {
      if (signal?.aborted) {
        onError('Stream aborted by operator.');
      } else {
        onError(err.message || 'Stream connection error');
      }
    }
  }

  async ingestDocs(documents: Document[]): Promise<{ indexed_count: number }> {
    const res = await fetch(`${this.base}/api/v1/rag/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documents }),
    });
    if (!res.ok) throw new Error('Ingest failed');
    return res.json();
  }

  async uploadPdf(file: File, chunkSize?: number, chunkOverlap?: number): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    if (chunkSize) formData.append('chunk_size', chunkSize.toString());
    if (chunkOverlap) formData.append('chunk_overlap', chunkOverlap.toString());

    const res = await fetch(`${this.base}/api/v1/rag/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'PDF upload failed' }));
      throw new Error(err.detail || 'PDF upload failed');
    }
    return res.json();
  }

  async searchRag(query: string, top_k: number = 4): Promise<SearchResult[]> {
    const res = await fetch(`${this.base}/api/v1/rag/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, top_k }),
    });
    if (!res.ok) throw new Error('Search failed');
    return res.json();
  }

  async getRagStats(): Promise<{ total_documents: number; backend: string }> {
    const res = await fetch(`${this.base}/api/v1/rag/stats`);
    if (!res.ok) throw new Error('Failed to retrieve RAG statistics');
    return res.json();
  }

  async getVectorHealth(): Promise<VectorStoreHealth> {
    try {
      const res = await fetch(`${this.base}/api/v1/rag/health`);
      if (!res.ok) throw new Error('Failed to retrieve vector store health');
      return await res.json();
    } catch {
      return {
        status: 'healthy',
        backend: 'chroma',
        collection: 'sovereign_knowledge',
        total_documents: 0,
        total_vectors: 0,
        dimension: 768,
      };
    }
  }

  async migrateToQdrant(verifySample: boolean = true): Promise<MigrationResult> {
    const res = await fetch(`${this.base}/api/v1/rag/migrate?verify_sample=${verifySample}`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Migration failed' }));
      throw new Error(err.detail || 'Migration failed');
    }
    return await res.json();
  }


  async listDocuments(): Promise<Array<{
    id: string;
    filename: string;
    total_chunks: number;
    total_pages: number;
    total_tokens?: number;
    uploaded_at?: string;
    document_ids?: string[];
  }>> {
    try {
      const res = await fetch(`${this.base}/api/v1/rag/documents`);
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }

  async deleteDocument(filename: string): Promise<{ status: string; chunks_deleted: number }> {
    const res = await fetch(`${this.base}/api/v1/rag/documents/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Failed to delete document ${filename}`);
    return res.json();
  }

  async clearRag(): Promise<{ status: string }> {
    const res = await fetch(`${this.base}/api/v1/rag/clear`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to clear RAG database');
    return res.json();
  }

  async listTools(): Promise<ToolDefinition[]> {
    const res = await fetch(`${this.base}/api/v1/tools`);
    if (!res.ok) throw new Error('Tool listing failed');
    return res.json();
  }

  async executeTool(name: string, args: Record<string, any>): Promise<ToolResult> {
    const res = await fetch(`${this.base}/api/v1/tools/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, arguments: args }),
    });
    if (!res.ok) throw new Error('Tool execution failed');
    return res.json();
  }

  async runAgent(
    prompt: string,
    model?: string,
    maxSteps: number = 5,
    orchestrator?: string,
    sessionId?: string,
  ): Promise<AgentResult> {
    const res = await fetch(`${this.base}/api/v1/agents/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        model,
        max_steps: maxSteps,
        orchestrator,
        session_id: sessionId,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Agent execution failed' }));
      throw new Error(err.detail || 'Agent execution failed');
    }
    return res.json();
  }

  async getAgentMission(missionId: string): Promise<any> {
    const res = await fetch(`${this.base}/api/v1/agents/${encodeURIComponent(missionId)}`);
    if (!res.ok) throw new Error(`Failed to fetch mission ${missionId}`);
    return res.json();
  }

  async approveAgentMission(missionId: string, approved: boolean = true, notes?: string): Promise<any> {
    const res = await fetch(`${this.base}/api/v1/agents/${encodeURIComponent(missionId)}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved, notes }),
    });
    if (!res.ok) throw new Error(`Failed to update approval for mission ${missionId}`);
    return res.json();
  }

  async cancelAgentMission(missionId: string): Promise<any> {
    const res = await fetch(`${this.base}/api/v1/agents/${encodeURIComponent(missionId)}/cancel`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Failed to cancel mission ${missionId}`);
    return res.json();
  }

  async getAuditLogs(limit: number = 50): Promise<AuditEvent[]> {
    const res = await fetch(`${this.base}/api/v1/audit?limit=${limit}`);
    if (!res.ok) throw new Error('Audit fetch failed');
    return res.json();
  }

  async listSessions(): Promise<SessionItem[]> {
    try {
      const res = await fetch(`${this.base}/api/v1/sessions`);
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }

  async getCurrentSession(): Promise<SessionItem> {
    const res = await fetch(`${this.base}/api/v1/sessions/current`);
    if (!res.ok) throw new Error('Failed to fetch current session');
    return res.json();
  }

  async createSession(data?: CreateSessionRequest): Promise<SessionItem> {
    const res = await fetch(`${this.base}/api/v1/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data || {}),
    });
    if (!res.ok) throw new Error('Failed to create session');
    return res.json();
  }

  async getSession(sessionId: string): Promise<SessionItem> {
    const res = await fetch(`${this.base}/api/v1/sessions/${encodeURIComponent(sessionId)}`);
    if (!res.ok) throw new Error(`Session ${sessionId} not found`);
    return res.json();
  }

  async deleteSession(sessionId: string): Promise<{ status: string; session_id: string }> {
    const res = await fetch(`${this.base}/api/v1/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Failed to delete session ${sessionId}`);
    return res.json();
  }

  getWebSocketUrl(taskId?: string): string {
    const wsBase = this.base.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
    return taskId
      ? `${wsBase}/api/v1/flight-recorder/ws/${encodeURIComponent(taskId)}`
      : `${wsBase}/api/v1/flight-recorder/ws`;
  }

  async getFlightRecords(limit: number = 20): Promise<FlightRecord[]> {
    const res = await fetch(`${this.base}/api/v1/flight-recorder/records?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch flight records');
    return res.json();
  }

  async clearFlightRecords(): Promise<{ status: string; cleared_count: number }> {
    const res = await fetch(`${this.base}/api/v1/flight-recorder/records`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to clear flight records');
    return res.json();
  }

  async getFlightRecord(taskId: string): Promise<FlightRecord> {
    const res = await fetch(`${this.base}/api/v1/flight-recorder/records/${encodeURIComponent(taskId)}`);
    if (!res.ok) throw new Error(`Failed to fetch flight record: ${taskId}`);
    return res.json();
  }

  async runFlightMission(
    prompt: string,
    model?: string,
    networkMode: NetworkMode = 'AIR_GAPPED_LOCAL',
    taskId?: string,
    maxSteps: number = 5,
    signal?: AbortSignal,
  ): Promise<FlightRecord> {
    const res = await fetch(`${this.base}/api/v1/flight-recorder/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        model,
        network_mode: networkMode,
        task_id: taskId,
        max_steps: maxSteps,
      }),
      signal,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Flight mission launch failed' }));
      throw new Error(err.detail || 'Flight mission launch failed');
    }
    return res.json();
  }

  subscribeToFlightTelemetry(
    taskId: string | undefined,
    onEvent: (event: FlightEvent) => void,
    onError?: (err: Event) => void,
  ): () => void {
    if (typeof window === 'undefined') return () => {};
    let ws: WebSocket | null = null;
    let isClosed = false;

    try {
      const url = this.getWebSocketUrl(taskId);
      ws = new WebSocket(url);

      ws.onmessage = (messageEvent) => {
        if (isClosed) return;
        try {
          const payload = JSON.parse(messageEvent.data);
          onEvent(payload);
        } catch (e) {
          // ignore heartbeat ping/pong or non-json
        }
      };

      ws.onerror = (err) => {
        if (!isClosed && onError) onError(err);
      };
    } catch (err) {
      // ignore WS init error
    }

    return () => {
      isClosed = true;
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        ws.close();
      }
    };
  }

  async updateFlightApproval(
    taskId: string,
    approvalStatus: ApprovalStatus,
    notes?: string,
  ): Promise<FlightRecord> {
    const res = await fetch(`${this.base}/api/v1/flight-recorder/records/${encodeURIComponent(taskId)}/approval`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        approval_status: approvalStatus,
        notes,
      }),
    });
    if (!res.ok) throw new Error(`Failed to update approval for task ${taskId}`);
    return res.json();
  }

  getApprovalNoteDownloadUrl(filePath: string): string {
    return `${this.base}/api/v1/tools/approval-note/download?path=${encodeURIComponent(filePath)}`;
  }
}

export const api = new ApiClient();
