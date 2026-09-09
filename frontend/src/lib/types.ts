/**
 * Type contracts mirroring Sovereign-Core backend schemas.
 */

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  role: ChatRole;
  content: string;
  name?: string;
  tool_call_id?: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  size_bytes?: number;
  digest?: string;
  modified_at?: string;
  details?: Record<string, any>;
}

export interface LLMUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface LLMResponse {
  content: string;
  model: string;
  finish_reason?: string;
  usage?: LLMUsage;
  latency_ms?: number;
}

export interface StreamChunk {
  content: string;
  done: boolean;
  model?: string;
  finish_reason?: string;
}

export interface HealthStatus {
  status: string;
  environment: string;
  ollama_connected: boolean;
  ollama_url: string;
  default_model?: string;
  default_model_available?: boolean;
  available_models?: string[];
  latency_ms?: number;
  error?: string | null;
}

export type ErrorCode =
  | 'NETWORK_OFFLINE'
  | 'OLLAMA_DISCONNECTED'
  | 'MISSION_TIMEOUT'
  | 'AGENT_EXECUTION_FAILED'
  | 'POLICY_VIOLATION'
  | 'VALIDATION_ERROR'
  | 'STREAM_ABORTED'
  | 'UNKNOWN_ERROR';

export type ErrorSeverity = 'fatal' | 'error' | 'warning' | 'info';

export interface AppError {
  code: ErrorCode;
  message: string;
  details?: string;
  severity: ErrorSeverity;
  timestamp: string;
  suggestedAction?: string;
  raw?: any;
}

export type MissionPhase = 'idle' | 'transmitting' | 'streaming' | 'completed' | 'failed' | 'aborted';


export interface Document {
  id: string;
  content: string;
  metadata?: Record<string, any>;
  embedding?: number[];
}

export interface SearchResult {
  document: Document;
  score: number;
}

export interface UploadResponse {
  filename: string;
  total_pages: number;
  total_chunks: number;
  document_ids: string[];
  status: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

export interface ToolResult {
  success: boolean;
  output: any;
  error?: string;
  execution_time_ms?: number;
}

export interface AgentStep {
  step_number: number;
  thought?: string;
  tool_name?: string;
  tool_arguments?: Record<string, any>;
  tool_result?: ToolResult;
  observation?: string;
  response?: string;
}

export interface AgentResult {
  session_id: string;
  final_response: string;
  steps: AgentStep[];
  success: boolean;
  error?: string;
  total_latency_ms?: number;
}

export type AuditEventType =
  | 'llm_request'
  | 'llm_response'
  | 'llm_error'
  | 'rag_ingest'
  | 'rag_query'
  | 'tool_execution'
  | 'agent_run'
  | 'system_event';

export interface AuditEvent {
  id: string;
  timestamp: string;
  event_type: AuditEventType;
  session_id?: string;
  model?: string;
  prompt_preview?: string;
  response_preview?: string;
  tokens?: {
    prompt?: number;
    completion?: number;
    total?: number;
  };
  latency_ms?: number;
  status: string;
  error?: string;
  payload?: Record<string, any>;
}

export type ApprovalStatus =
  | 'AUTO_VERIFIED'
  | 'APPROVED'
  | 'PENDING'
  | 'REJECTED'
  | 'POLICY_VIOLATION'
  | 'FAILED';

export type NetworkMode = 'AIR_GAPPED_LOCAL' | 'NO_EGRESS';

export type FlightEventType =
  | 'task_started'
  | 'step_started'
  | 'tool_called'
  | 'sources_retrieved'
  | 'tool_completed'
  | 'artifact_generated'
  | 'error_recorded'
  | 'task_completed'
  | 'approval_updated'
  | 'connected'
  | 'pong'
  | 'subscribed'
  | 'error';

export interface RetrievedSource {
  document_name: string;
  page_number?: number;
  similarity_score: number;
  chunk_preview: string;
  metadata?: Record<string, any>;
}

export interface GeneratedArtifact {
  artifact_id: string;
  artifact_type: string;
  title: string;
  content: string;
  checksum_sha256: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface RecordedError {
  step_number?: number;
  error_message: string;
  severity: 'error' | 'warning' | 'policy_violation';
  timestamp: string;
}

export interface ToolExecutionRecord {
  step_number: number;
  tool_name: string;
  tool_arguments: Record<string, any>;
  execution_time_ms: number;
  success: boolean;
  error?: string;
  output_preview?: string;
}

export interface FlightEvent {
  event_type: FlightEventType;
  task_id: string;
  timestamp: string;
  data: Record<string, any>;
}

export interface StepRecord {
  step_number: number;
  thought?: string;
  tool_name?: string;
  tool_arguments?: Record<string, any>;
  observation?: string;
  timestamp?: string;
  status?: string;
}

export interface FlightRecord {
  task_id: string;
  model: string;
  prompt: string;
  network_mode: NetworkMode;
  approval_status: ApprovalStatus;
  status: 'running' | 'completed' | 'failed';
  start_time: string;
  end_time?: string;
  total_latency_ms?: number;
  steps: StepRecord[];
  tools_called: ToolExecutionRecord[];
  retrieved_sources: RetrievedSource[];
  artifacts_generated: GeneratedArtifact[];
  errors: RecordedError[];
  final_response?: string;
  metadata: Record<string, any>;
}

