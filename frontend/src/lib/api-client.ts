import { AgentResult, ApprovalStatus, AuditEvent, ChatMessage, FlightRecord, HealthStatus, ModelInfo, NetworkMode, SearchResult, ToolDefinition, ToolResult } from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(
      `API request failed: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

export const api = {
  getHealth: () => request<HealthStatus>('/api/v1/health'),
  listModels: () => request<ModelInfo[]>('/api/v1/models'),
  sendChat: (messages: ChatMessage[], model?: string) => request<{ content: string; latency_ms?: number; usage?: { total_tokens?: number } }>('/api/v1/chat', { method: 'POST', body: JSON.stringify({ messages, model, stream: false }) }),
  async streamChat(messages: ChatMessage[], model: string | undefined, onChunk: (chunk: string) => void, onComplete: () => void, onError: (message: string) => void) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages, model, stream: true }) });
      if (!response.ok || !response.body) throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
      while (true) { const { done, value } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const events = buffer.split('\n\n'); buffer = events.pop() || ''; for (const event of events) for (const line of event.split('\n')) if (line.startsWith('data: ')) { const data = JSON.parse(line.slice(6)); if (data.error) throw new Error(data.error); if (data.content) onChunk(data.content); } }
      onComplete();
    } catch (error) { onError(error instanceof Error ? error.message : String(error)); }
  },
  uploadPdf: async (file: File) => { const form = new FormData(); form.append('file', file); const response = await fetch(`${API_BASE_URL}/api/v1/rag/upload`, { method: 'POST', body: form }); if (!response.ok) throw new Error(`API request failed: ${response.status} ${response.statusText}`); return response.json() as Promise<{ filename: string; total_pages: number; total_chunks: number }>; },
  ingestDocs: (documents: { id: string; content: string; metadata?: Record<string, unknown> }[]) => request('/api/v1/rag/ingest', { method: 'POST', body: JSON.stringify({ documents }) }),
  searchRag: (query: string, top_k = 4) => request<SearchResult[]>('/api/v1/rag/search', { method: 'POST', body: JSON.stringify({ query, top_k }) }),
  listTools: () => request<ToolDefinition[]>('/api/v1/tools'),
  executeTool: (name: string, arguments_: Record<string, unknown>) => request<ToolResult>('/api/v1/tools/execute', { method: 'POST', body: JSON.stringify({ name, arguments: arguments_ }) }),
  runAgent: (prompt: string, model?: string, maxSteps = 5) => request<AgentResult>('/api/v1/agents/run', { method: 'POST', body: JSON.stringify({ prompt, model, max_steps: maxSteps }) }),
  getAuditLogs: (limit = 50) => request<AuditEvent[]>(`/api/v1/audit?limit=${limit}`),
  runFlightMission: (prompt: string, model: string | undefined, network_mode: NetworkMode, task_id: string | undefined, max_steps: number) => request<FlightRecord>('/api/v1/flight-recorder/run', { method: 'POST', body: JSON.stringify({ prompt, model, network_mode, task_id, max_steps }) }),
  getFlightRecords: (limit = 20) => request<FlightRecord[]>(`/api/v1/flight-recorder/records?limit=${limit}`),
  updateFlightApproval: (taskId: string, approval_status: ApprovalStatus, notes?: string) => request<FlightRecord>(`/api/v1/flight-recorder/records/${encodeURIComponent(taskId)}/approval`, { method: 'PATCH', body: JSON.stringify({ approval_status, notes }) }),
  getApprovalNoteDownloadUrl: (path: string) => `${API_BASE_URL}/api/v1/tools/approval-note/download?path=${encodeURIComponent(path)}`,
  getWebSocketUrl: () => `${API_BASE_URL.replace(/^http/, 'ws')}/api/v1/flight-recorder/ws`,
};
