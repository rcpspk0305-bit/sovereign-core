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
  provider?: string;
  is_local?: boolean;
  status?: 'READY' | 'AVAILABLE' | 'DISABLED' | 'UNCONFIGURED' | string;
  capabilities?: string[];
  context_window?: number;
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

export interface VectorStoreHealth {
  status: 'healthy' | 'degraded' | 'unavailable' | string;
  backend: 'chroma' | 'qdrant' | string;
  collection: string;
  total_documents: number;
  total_vectors: number;
  dimension?: number | null;
  endpoint?: string | null;
  error?: string | null;
}

export interface MigrationResult {
  success: boolean;
  source_backend: string;
  target_backend: string;
  source_count: number;
  migrated_count: number;
  target_count: number;
  dimension: number;
  sample_retrieved: boolean;
  sample_score?: number | null;
  sample_document_name?: string | null;
  duration_seconds: number;
  original_collection_preserved: boolean;
  error?: string | null;
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
  | 'error'
  | 'mission.created'
  | 'agent.selected'
  | 'agent.started'
  | 'agent.step.started'
  | 'agent.step.completed'
  | 'tool.started'
  | 'evidence.found'
  | 'verification.started'
  | 'verification.completed'
  | 'approval.requested'
  | 'agent.completed'
  | 'agent.failed'
  | 'mission.completed';

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
  trace_id?: string;
  span_id?: string;
}

export interface FlightEvent {
  event_type: FlightEventType | string;
  task_id: string;
  timestamp: string;
  data: Record<string, any>;
  trace_id?: string;
  span_id?: string;
}

export interface StepRecord {
  step_number: number;
  thought?: string;
  tool_name?: string;
  tool_arguments?: Record<string, any>;
  observation?: string;
  timestamp?: string;
  status?: string;
  trace_id?: string;
  span_id?: string;
  latency_ms?: number;
  tokens?: number;
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
  trace_id?: string;
  span_id?: string;
  steps: StepRecord[];
  tools_called: ToolExecutionRecord[];
  retrieved_sources: RetrievedSource[];
  artifacts_generated: GeneratedArtifact[];
  errors: RecordedError[];
  final_response?: string;
  metadata: Record<string, any>;
}

export interface MemoryBreakdown {
  user_input_tokens: number;
  tools_tokens: number;
  user_facts_tokens: number;
  internal_chatter_tokens: number;
  retrieved_facts_tokens: number;
  total_tokens: number;
  max_context_window: number;
}

export interface SessionTurn {
  turn_id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  type: 'user_input' | 'tool_schema' | 'user_fact' | 'internal_chatter' | 'retrieved_fact';
  content: string;
  timestamp: string;
  tokens: number;
}

export interface SessionItem {
  session_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  date_formatted: string;
  time_formatted: string;
  status: 'active' | 'archived' | 'completed';
  model: string;
  turns_count: number;
  memory_breakdown: MemoryBreakdown;
  recent_turns: SessionTurn[];
}

export interface CreateSessionRequest {
  title?: string;
  model?: string;
}

export interface WorkflowNodeModel {
  id: string;
  label: string;
  type: 'trigger' | 'router' | 'agent' | 'retrieval' | 'eval' | 'model' | 'seal' | 'tool' | 'custom';
  handler?: string;
  tool?: string;
  agent?: string;
  input?: Record<string, any>;
  output?: Record<string, any>;
  condition?: string;
  status: 'idle' | 'running' | 'completed' | 'failed' | 'skipped';
  latencyMs?: number;
}

export interface WorkflowEdgeModel {
  source: string;
  target: string;
  condition?: string;
}

export interface WorkflowGraphModel {
  id: string;
  name: string;
  description?: string;
  nodes: WorkflowNodeModel[];
  edges: WorkflowEdgeModel[];
}

export interface GraphExecutionState {
  mission_id: string;
  task: string;
  current_step: number;
  max_steps: number;
  selected_model: string;
  current_node?: string;
  completed_nodes: string[];
  tool_calls: Array<{ tool: string; args: Record<string, any> }>;
  tool_results: Array<Record<string, any>>;
  evidence: Array<Record<string, any>>;
  citations: string[];
  provenance: Record<string, any>;
  verification_status: 'unverified' | 'in_progress' | 'verified' | 'rejected';
  approval_required: boolean;
  approval_status: 'pending' | 'approved' | 'rejected' | 'auto_approved';
  errors: string[];
  final_output: string;
}

// Canonical Sovereign-Core Workflow & Dify Interoperability Schema
export type CanonicalNodeType =
  | 'START'
  | 'LLM'
  | 'AGENT'
  | 'TOOL'
  | 'RAG'
  | 'CONDITION'
  | 'APPROVAL'
  | 'END';

export type CanonicalWorkflowState =
  | 'DRAFT'
  | 'VALID'
  | 'INVALID'
  | 'APPROVAL REQUIRED'
  | 'READY'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED';

export interface CanonicalWorkflowNode {
  id: string;
  name: string;
  type: CanonicalNodeType;
  config: Record<string, any>;
  inputs?: string[] | Record<string, any>;
  outputs?: string[] | Record<string, any>;
  position?: { x: number; y: number };
  status?: 'idle' | 'running' | 'completed' | 'failed' | 'skipped';
}

export interface CanonicalWorkflowEdge {
  id: string;
  source: string;
  target: string;
  condition?: string;
  label?: string;
}

export interface CanonicalWorkflowPolicy {
  no_egress: boolean;
  tool_allowlist: string[];
  max_steps: number;
  requires_approval: boolean;
  resource_limits?: Record<string, any>;
  allowed_providers?: string[];
}

export interface SecurityFinding {
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  rule_violated: string;
  node_id?: string;
  field_path?: string;
}

export interface SecurityAnalysisReport {
  is_safe: boolean;
  state: CanonicalWorkflowState;
  risk_score: number;
  requires_approval: boolean;
  findings: SecurityFinding[];
  analyzed_at: string;
}

export interface CanonicalWorkflow {
  id: string;
  name: string;
  version: string;
  description?: string;
  nodes: CanonicalWorkflowNode[];
  edges: CanonicalWorkflowEdge[];
  inputs?: Record<string, any>;
  outputs?: Record<string, any>;
  policy: CanonicalWorkflowPolicy;
  state: CanonicalWorkflowState;
  approval_status?: string;
  approved_by?: string;
  approved_at?: string;
  security_analysis?: SecurityAnalysisReport;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface CanonicalWorkflowExecutionResponse {
  workflow_id: string;
  execution_id: string;
  success: boolean;
  state: CanonicalWorkflowState;
  final_output: Record<string, any>;
  step_results: Array<{
    node_id: string;
    status: string;
    inputs: Record<string, any>;
    outputs: Record<string, any>;
    latency_ms: number;
    error?: string;
  }>;
  total_latency_ms: number;
  error?: string;
  flight_record_id?: string;
}

// Sovereign-Core Agent Squad Contracts
export type AgentSquadStatus =
  | 'IDLE'
  | 'QUEUED'
  | 'PLANNING'
  | 'RUNNING'
  | 'WAITING_FOR_TOOL'
  | 'VERIFYING'
  | 'WAITING_FOR_APPROVAL'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'POLICY_BLOCKED';

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  purpose: string;
  capabilities: string[];
  allowed_tools: string[];
  input_schema: Record<string, any>;
  output_schema: Record<string, any>;
  system_instructions: string;
  max_steps: number;
  evidence_requirements: string[];
  failure_policy: string;
  approval_policy: 'AUTOMATIC' | 'HUMAN_REQUIRED';
}

export interface TaskClassificationResult {
  category: string;
  target_agent_id: string;
  confidence: number;
  reasoning: string;
  suggested_pipeline: string[];
  requires_clarification: boolean;
}

export interface MissionStep {
  step_number: number;
  thought?: string;
  tool_name?: string;
  tool_arguments?: Record<string, any>;
  observation?: string;
  timestamp?: string;
  status?: string;
}

export interface MissionState {
  mission_id: string;
  task: string;
  agent_id: string;
  agent_name: string;
  model: string;
  status: AgentSquadStatus | string;
  pipeline: string[];
  current_step: number;
  max_steps: number;
  steps: MissionStep[];
  tools_called: Array<Record<string, any>>;
  evidence: Array<Record<string, any>>;
  citations: string[];
  verification_status: string;
  approval_status: string;
  requires_approval: boolean;
  errors: string[];
  final_output: string | null;
  started_at: string;
  completed_at?: string | null;
  approval_notes?: string | null;
}

export interface ComplianceCheck {
  rule: string;
  status: 'COMPLIANT' | 'NON_COMPLIANT' | 'INSUFFICIENT_EVIDENCE';
  evidence: string[];
  reason: string;
}

export interface ComplianceReport {
  status: 'COMPLIANT' | 'NON_COMPLIANT' | 'INSUFFICIENT_EVIDENCE';
  checks: ComplianceCheck[];
  overall_confidence: number;
}
