export interface ToolResult { success: boolean; output: any; error?: string; execution_time_ms?: number; }
export interface ToolDefinition { name: string; description: string; parameters: Record<string, unknown>; }
export interface AgentStep { step_number: number; thought?: string; action?: string; tool_name?: string; tool_arguments?: Record<string, any>; tool_result?: ToolResult; observation?: string; timestamp?: string; }
export interface AgentResult { session_id: string; final_response: string; steps: AgentStep[]; success: boolean; error?: string; total_latency_ms?: number; metadata?: Record<string, any>; }
export interface AuditEvent { id: string; timestamp: string; event_type: string; session_id?: string; model?: string; prompt_preview?: string; response_preview?: string; tokens?: Record<string, number>; latency_ms?: number; status: string; error?: string; payload: Record<string, any>; }
export interface ChatMessage { role: 'user' | 'assistant' | 'system' | 'tool'; content: string; name?: string; tool_call_id?: string; timestamp?: string; }
export interface ModelInfo { id: string; name: string; size_bytes?: number; digest?: string; modified_at?: string; details?: Record<string, any>; }
export interface HealthStatus { status: string; environment: string; ollama_connected: boolean; ollama_url: string; default_model: string; default_model_available: boolean; available_models: string[]; latency_ms?: number; error?: string; }
export interface Document { id: string; content: string; metadata?: Record<string, any>; embedding?: number[]; }
export interface SearchResult { document: Document; score: number; }
export type ApprovalStatus = 'AUTO_VERIFIED' | 'APPROVED' | 'PENDING' | 'REJECTED' | 'POLICY_VIOLATION' | 'FAILED';
export type NetworkMode = 'AIR_GAPPED_LOCAL' | 'NO_EGRESS';
export interface RetrievedSource { document_name: string; page_number?: number; similarity_score: number; chunk_preview: string; metadata: Record<string, any>; }
export interface GeneratedArtifact { artifact_id: string; artifact_type: string; title: string; content: string; checksum_sha256: string; timestamp: string; metadata: Record<string, any>; }
export interface RecordedError { step_number?: number; error_message: string; severity: string; timestamp: string; }
export interface ToolExecutionRecord { step_number: number; tool_name: string; tool_arguments: Record<string, any>; execution_time_ms: number; success: boolean; error?: string; output_preview?: string; }
export interface StepRecord { step_number: number; thought?: string; tool_name?: string; tool_arguments?: Record<string, any>; observation?: string; timestamp?: string; status?: string; }
export interface FlightEvent { event_type: string; task_id: string; timestamp: string; data: Record<string, any>; }
export interface FlightRecord { task_id: string; model: string; prompt: string; network_mode: NetworkMode; approval_status: ApprovalStatus; status: string; start_time: string; end_time?: string; total_latency_ms?: number; steps: StepRecord[]; tools_called: ToolExecutionRecord[]; retrieved_sources: RetrievedSource[]; artifacts_generated: GeneratedArtifact[]; errors: RecordedError[]; final_response?: string; metadata: Record<string, any>; }
