'use client';

import React from 'react';
import {
  ArrowUpRight,
  Bot,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Database,
  FileCheck2,
  FileCode2,
  FileSearch,
  FileText,
  Flame,
  Layers,
  Lock,
  Orbit,
  Radar,
  Radio,
  Server,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Sun,
  Terminal,
  Waves,
  Wrench,
  Zap,
} from 'lucide-react';

interface WorkflowSectionProps {
  onLaunchWorkbench: () => void;
}

export default function WorkflowSection({ onLaunchWorkbench }: WorkflowSectionProps) {
  return (
    <div className="workflow-container">
      {/* ---------------------------------------------------- */}
      {/* STAGE 1: AIR-GAP VECTOR INGESTION (WARP STARFIELD) */}
      {/* ---------------------------------------------------- */}
      <section className="workflow-stage" id="ingestion">
        <div className="stage-marker">
          <div className="marker-dot" />
          <div className="marker-line" />
          <span className="marker-tag">COSMIC STAGE 01 // STARFIELD WARP</span>
        </div>

        <div className="stage-grid">
          <div className="stage-info-panel">
            <div className="stage-eyebrow">
              <Database size={15} />
              <span>DATA SOVEREIGNTY INGESTION</span>
            </div>
            <h2 className="stage-title">
              Turn Confidential Documents Into Navigable Vector Space.
            </h2>
            <p className="stage-desc">
              Sensitive defense, legal, and operational documents should never be uploaded to third-party cloud APIs.
              Sovereign-Core ingests and vectorizes files completely in-memory and on-disk within your local perimeter.
            </p>

            <div className="stage-feature-list">
              <div className="stage-feature-item">
                <CheckCircle2 size={16} className="feature-icon-cyan" />
                <div>
                  <strong>PyMuPDF Native PDF Parsing:</strong>
                  <span> Page-by-page layout preservation and chunk metadata mapping.</span>
                </div>
              </div>
              <div className="stage-feature-item">
                <CheckCircle2 size={16} className="feature-icon-cyan" />
                <div>
                  <strong>Smart Overlapping Chunker:</strong>
                  <span> 500-token chunks with 50-token semantic overlap to retain contextual continuity.</span>
                </div>
              </div>
              <div className="stage-feature-item">
                <CheckCircle2 size={16} className="feature-icon-cyan" />
                <div>
                  <strong>ChromaDB Vector Index:</strong>
                  <span> Persistent HNSW cosine distance indexing (<code className="code-pill">hnsw:space: cosine</code>) with zero external network dependencies.</span>
                </div>
              </div>
              <div className="stage-feature-item">
                <CheckCircle2 size={16} className="feature-icon-cyan" />
                <div>
                  <strong>Exact Source Attribution:</strong>
                  <span> Retains document name, page number, and chunk index for tamper-proof citations.</span>
                </div>
              </div>
            </div>
          </div>

          <div className="stage-visual-card">
            <div className="card-header-bar">
              <span className="card-dot red" />
              <span className="card-dot yellow" />
              <span className="card-dot green" />
              <span className="card-title-text">INGESTION_PIPELINE.LOG</span>
              <span className="card-status-pill">AIR-GAPPED</span>
            </div>

            <div className="card-body-content">
              <div className="metric-row">
                <div className="metric-box">
                  <span className="metric-sub">PARSER SPEED</span>
                  <span className="metric-val">1,240 p/s</span>
                  <span className="metric-note">PyMuPDF Core</span>
                </div>
                <div className="metric-box">
                  <span className="metric-sub">VECTOR DISTANCE</span>
                  <span className="metric-val">COSINE</span>
                  <span className="metric-note">ChromaDB HNSW</span>
                </div>
                <div className="metric-box">
                  <span className="metric-sub">CLOUD EGRESS</span>
                  <span className="metric-val highlight-cyan">0.00%</span>
                  <span className="metric-note">No Outbound Packets</span>
                </div>
              </div>

              <div className="code-terminal-block">
                <div className="terminal-line text-cyan">
                  <span>[INGEST]</span> Reading confidential_spec_v2.pdf (14 pages)...
                </div>
                <div className="terminal-line text-slate">
                  <span>[CHUNK]</span> Generated 38 overlapping chunks (500 tokens, 50 overlap)
                </div>
                <div className="terminal-line text-green">
                  <span>[EMBED]</span> nomic-embed-text:latest generated 38 dense embeddings
                </div>
                <div className="terminal-line text-amber">
                  <span>[INDEX]</span> ChromaDB collection `sovereign_knowledge` updated in 142ms
                </div>
                <div className="terminal-line text-cyan">
                  <span>[VERIFY]</span> Document ready for citation-grounded local reasoning.
                </div>
              </div>

              <div className="card-footer-badge">
                <ShieldCheck size={14} />
                <span>Zero telemetry leaks to external model vendors</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- */}
      {/* STAGE 2: LOCAL NEURAL CORE (THE BLAZING SUN) */}
      {/* ---------------------------------------------------- */}
      <section className="workflow-stage" id="engine">
        <div className="stage-marker">
          <div className="marker-dot sun-glow" />
          <div className="marker-line" />
          <span className="marker-tag">COSMIC STAGE 02 // BLAZING SOLAR CORE</span>
        </div>

        <div className="stage-grid">
          <div className="stage-info-panel">
            <div className="stage-eyebrow text-amber">
              <Sun size={15} />
              <span>AIR-GAPPED COMPUTE ENGINE</span>
            </div>
            <h2 className="stage-title">
              Local LLM Reasoning Powered by Native Gemma 4.
            </h2>
            <p className="stage-desc">
              At the center of Sovereign-Core burns a high-efficiency local model engine.
              Running directly on consumer or enterprise workstations via Ollama, it provides sub-second time-to-first-token without sending a single byte over the public internet.
            </p>

            <div className="stage-feature-list">
              <div className="stage-feature-item">
                <Flame size={16} className="feature-icon-amber" />
                <div>
                  <strong>Default Gemma 4 E2B & E4B Models:</strong>
                  <span> Tailored for high-precision instruction following and structured JSON tool-call schema compliance.</span>
                </div>
              </div>
              <div className="stage-feature-item">
                <Flame size={16} className="feature-icon-amber" />
                <div>
                  <strong>Typed Service Abstraction:</strong>
                  <span> High-level <code className="code-pill">LLMService</code> architecture decouples reasoning from raw Ollama endpoints with graceful failover.</span>
                </div>
              </div>
              <div className="stage-feature-item">
                <Flame size={16} className="feature-icon-amber" />
                <div>
                  <strong>Strict Error Recovery:</strong>
                  <span> Handles disconnects, memory constraints, and model timeouts with self-healing fallback states.</span>
                </div>
              </div>
              <div className="stage-feature-item">
                <Flame size={16} className="feature-icon-amber" />
                <div>
                  <strong>Dynamic Model Discovery:</strong>
                  <span> Inspects local VRAM capacity and automatically selects available quantized checkpoints.</span>
                </div>
              </div>
            </div>
          </div>

          <div className="stage-visual-card solar-border">
            <div className="card-header-bar">
              <span className="card-dot red" />
              <span className="card-dot yellow" />
              <span className="card-dot green" />
              <span className="card-title-text">LOCAL_MODEL_TELEMETRY</span>
              <span className="card-status-pill amber-glow">OLLAMA_CONNECTED</span>
            </div>

            <div className="card-body-content">
              <div className="solar-stat-panel">
                <div className="solar-flame-stat">
                  <div className="flame-radial-glow" />
                  <span className="stat-big">sub-28ms</span>
                  <span className="stat-label">TIME TO FIRST TOKEN</span>
                </div>
                <div className="solar-details-grid">
                  <div className="detail-item">
                    <span>ACTIVE MODEL</span>
                    <strong>gemma4:e2b</strong>
                  </div>
                  <div className="detail-item">
                    <span>CONTEXT WINDOW</span>
                    <strong>8,192 TOKENS</strong>
                  </div>
                  <div className="detail-item">
                    <span>GPU / NPU ACCEL</span>
                    <strong>METAL / CUDA / ROCM</strong>
                  </div>
                  <div className="detail-item">
                    <span>NETWORK EGRESS</span>
                    <strong className="text-cyan">0 BYTES</strong>
                  </div>
                </div>
              </div>

              <div className="code-terminal-block">
                <div className="terminal-line text-amber">
                  <span>[INFERENCE]</span> Request dispatched to Ollama daemon (127.0.0.1:11434)
                </div>
                <div className="terminal-line text-slate">
                  <span>[TOKENS]</span> Generating streaming tokens: 68.4 tokens/sec
                </div>
                <div className="terminal-line text-cyan">
                  <span>[CITATIONS]</span> Injecting vector context chunks #01, #04, #09
                </div>
                <div className="terminal-line text-green">
                  <span>[SAFETY]</span> Zero external DNS queries verified by internal guardrail.
                </div>
              </div>

              <div className="card-footer-badge amber-badge">
                <Cpu size={14} />
                <span>Deterministic air-gapped local intelligence</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- */}
      {/* STAGE 3: CONTROLLED TOOL BAY (METEOR SHOWER) */}
      {/* ---------------------------------------------------- */}
      <section className="workflow-stage" id="tools">
        <div className="stage-marker">
          <div className="marker-dot meteor-glow" />
          <div className="marker-line" />
          <span className="marker-tag">COSMIC STAGE 03 // METEOR FIELD & TOOL BELT</span>
        </div>

        <div className="stage-grid">
          <div className="stage-info-panel">
            <div className="stage-eyebrow text-emerald">
              <Wrench size={15} />
              <span>BOUNDED AGENTIC EXECUTION</span>
            </div>
            <h2 className="stage-title">
              Every Action Stays Strictly Inside the Security Boundary.
            </h2>
            <p className="stage-desc">
              Autonomous AI agents can be dangerous when given unrestricted shell or web access.
              Sovereign-Core enforces a bounded reasoning loop with fixed step budgets (1 to 10 steps) and an isolated Tool Bay limited to safe, audited tools.
            </p>

            <div className="stage-feature-list">
              <div className="stage-feature-item">
                <ShieldAlert size={16} className="feature-icon-emerald" />
                <div>
                  <strong>Deterministic Step Ceilings:</strong>
                  <span> Configurable step-budget bounds eliminate runaway loops and compute resource exhaustion.</span>
                </div>
              </div>
              <div className="stage-feature-item">
                <ShieldAlert size={16} className="feature-icon-emerald" />
                <div>
                  <strong>Document Retrieval Tool:</strong>
                  <span> Queries the local ChromaDB vector store for grounded citations without web scraping.</span>
                </div>
              </div>
              <div className="stage-feature-item">
                <ShieldAlert size={16} className="feature-icon-emerald" />
                <div>
                  <strong>Mathematical Calculator Tool:</strong>
                  <span> Exact symbolic and numerical calculation without hallucinated arithmetic.</span>
                </div>
              </div>
              <div className="stage-feature-item">
                <ShieldAlert size={16} className="feature-icon-emerald" />
                <div>
                  <strong>Approval Note Generator Tool:</strong>
                  <span> Compiles verified insights into structured, cryptographically hashed sign-off notes.</span>
                </div>
              </div>
            </div>
          </div>

          <div className="stage-visual-card emerald-border">
            <div className="card-header-bar">
              <span className="card-dot red" />
              <span className="card-dot yellow" />
              <span className="card-dot green" />
              <span className="card-title-text">REGISTERED_TOOL_BAY</span>
              <span className="card-status-pill green-glow">SANDBOX_LOCKED</span>
            </div>

            <div className="card-body-content">
              <div className="tool-cards-stack">
                <div className="tool-item-pill">
                  <div className="tool-icon-wrap">
                    <FileSearch size={16} />
                  </div>
                  <div className="tool-info">
                    <strong>document_retrieval</strong>
                    <span>Semantic vector context retrieval</span>
                  </div>
                  <span className="tool-badge-status">READ-ONLY</span>
                </div>

                <div className="tool-item-pill">
                  <div className="tool-icon-wrap">
                    <Terminal size={16} />
                  </div>
                  <div className="tool-info">
                    <strong>calculator</strong>
                    <span>Deterministic numerical calculations</span>
                  </div>
                  <span className="tool-badge-status">SANDBOXED</span>
                </div>

                <div className="tool-item-pill">
                  <div className="tool-icon-wrap">
                    <FileText size={16} />
                  </div>
                  <div className="tool-info">
                    <strong>document_generation</strong>
                    <span>Structured Markdown / JSON synthesis</span>
                  </div>
                  <span className="tool-badge-status">LOCAL-ONLY</span>
                </div>

                <div className="tool-item-pill highlight-tool">
                  <div className="tool-icon-wrap">
                    <FileCheck2 size={16} />
                  </div>
                  <div className="tool-info">
                    <strong>approval_note_generator</strong>
                    <span>Cryptographic DOCX artifact generation</span>
                  </div>
                  <span className="tool-badge-status cyan">SHA-256</span>
                </div>
              </div>

              <div className="card-footer-badge emerald-badge">
                <Lock size={14} />
                <span>Zero shell access, zero autonomous web access</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- */}
      {/* STAGE 4: FLIGHT RECORDER & AUDIT (MILKY WAY GALAXY) */}
      {/* ---------------------------------------------------- */}
      <section className="workflow-stage" id="audit">
        <div className="stage-marker">
          <div className="marker-dot galaxy-glow" />
          <div className="marker-line" />
          <span className="marker-tag">COSMIC STAGE 04 // SPIRAL GALAXY FLIGHT RECORDER</span>
        </div>

        <div className="stage-grid">
          <div className="stage-info-panel">
            <div className="stage-eyebrow text-cyan">
              <Radar size={15} />
              <span>BLACKBOX MISSION TELEMETRY</span>
            </div>
            <h2 className="stage-title">
              Nothing Important Leaves the AI Flight Recorder.
            </h2>
            <p className="stage-desc">
              In mission-critical intelligence, accountability is non-negotiable.
              Every prompt, reasoning token, tool execution, intermediate scratchpad thought, and citation is streamed over WebSockets and sealed in a durable local blackbox record.
            </p>

            <div className="stage-feature-list">
              <div className="stage-feature-item">
                <Sparkles size={16} className="feature-icon-cyan" />
                <div>
                  <strong>Live WebSocket Telemetry:</strong>
                  <span> Real-time event broadcasting (<code className="code-pill">/api/v1/flight-recorder/ws</code>) for full reasoning observability.</span>
                </div>
              </div>
              <div className="stage-feature-item">
                <Sparkles size={16} className="feature-icon-cyan" />
                <div>
                  <strong>Durable Blackbox Records:</strong>
                  <span> Persists task ID, model specs, step traces, tool executions, errors, and output artifacts.</span>
                </div>
              </div>
              <div className="stage-feature-item">
                <Sparkles size={16} className="feature-icon-cyan" />
                <div>
                  <strong>Cryptographic SHA-256 Checksums:</strong>
                  <span> Produces verifiable approval documents with cryptographic tamper-evident signatures.</span>
                </div>
              </div>
              <div className="stage-feature-item">
                <Sparkles size={16} className="feature-icon-cyan" />
                <div>
                  <strong>Auditor Disposition Workflow:</strong>
                  <span> Human-in-the-loop sign-off states (<code className="code-pill">AUTO_VERIFIED</code>, <code className="code-pill">APPROVED</code>, <code className="code-pill">POLICY_VIOLATION</code>).</span>
                </div>
              </div>
            </div>
          </div>

          <div className="stage-visual-card galaxy-border">
            <div className="card-header-bar">
              <span className="card-dot red" />
              <span className="card-dot yellow" />
              <span className="card-dot green" />
              <span className="card-title-text">BLACKBOX_MISSION_RECORDER.JSON</span>
              <span className="card-status-pill cyan-glow">STREAM_ACTIVE</span>
            </div>

            <div className="card-body-content">
              <div className="audit-provenance-box">
                <div className="audit-header">
                  <div className="audit-meta">
                    <span className="task-id">TASK_ID // sc-mission-9842a</span>
                    <span className="badge-verified">SHA-256 VERIFIED</span>
                  </div>
                  <span className="timestamp">2026-09-09T17:15:00Z</span>
                </div>

                <div className="audit-step-timeline">
                  <div className="timeline-step done">
                    <div className="step-circle">1</div>
                    <div className="step-content">
                      <strong>Prompt Ingestion</strong>
                      <span>Validated schema and context parameters</span>
                    </div>
                  </div>
                  <div className="timeline-step done">
                    <div className="step-circle">2</div>
                    <div className="step-content">
                      <strong>Vector Retrieval</strong>
                      <span>3 citations matched from ChromaDB HNSW (94.2% sim)</span>
                    </div>
                  </div>
                  <div className="timeline-step done">
                    <div className="step-circle">3</div>
                    <div className="step-content">
                      <strong>Local LLM Synthesis</strong>
                      <span>Gemma 4 reasoning executed (sub-second latency)</span>
                    </div>
                  </div>
                  <div className="timeline-step active">
                    <div className="step-circle">4</div>
                    <div className="step-content">
                      <strong>Approval Note Generated</strong>
                      <span>SHA-256 hash: e617fdc... sealed with human sign-off block</span>
                    </div>
                  </div>
                </div>

                <div className="disposition-strip">
                  <span className="disposition-label">AUDITOR DISPOSITION:</span>
                  <span className="disp-tag approved">AUTO_VERIFIED</span>
                  <span className="disp-tag">APPROVED</span>
                  <span className="disp-tag">REJECTED</span>
                </div>
              </div>

              <div className="card-footer-badge cyan-badge">
                <Radar size={14} />
                <span>Full decision provenance & cryptographic sign-off</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- */}
      {/* STAGE 5: DOCKING & INTERACTIVE WORKBENCH LAUNCH */}
      {/* ---------------------------------------------------- */}
      <section className="workflow-stage final-stage" id="workbench-preview">
        <div className="stage-marker">
          <div className="marker-dot station-glow" />
          <div className="marker-line" />
          <span className="marker-tag">COSMIC STAGE 05 // ORBITAL DOCKING STATION</span>
        </div>

        <div className="stage-docking-card">
          <div className="docking-glow-sphere" />

          <div className="docking-content">
            <div className="docking-badge">
              <Orbit size={16} className="space-nav-spin" />
              <span>ALL SYSTEMS NOMINAL // LOCAL WORKBENCH ARMED</span>
            </div>

            <h2 className="docking-title">
              Step Into the 3D Interactive Workbench
            </h2>
            <p className="docking-subtitle">
              Experience the 4 operational bays of Sovereign-Core in real-time.
              Run live prompts against local Gemma 4, query your local ChromaDB vector memory, execute sandbox tools, and inspect live WebSocket telemetry streams.
            </p>

            <div className="docking-bays-grid">
              <div className="docking-bay-card" onClick={onLaunchWorkbench}>
                <div className="bay-icon-pill">
                  <Orbit size={20} />
                </div>
                <h3>01. Mission Control</h3>
                <p>3D interactive console, live streaming thought progression, and millisecond elapsed timer.</p>
              </div>

              <div className="docking-bay-card" onClick={onLaunchWorkbench}>
                <div className="bay-icon-pill">
                  <Database size={20} />
                </div>
                <h3>02. Knowledge Field</h3>
                <p>ChromaDB vector statistics, semantic memory search with similarity bars, and PDF drag-and-drop.</p>
              </div>

              <div className="docking-bay-card" onClick={onLaunchWorkbench}>
                <div className="bay-icon-pill">
                  <Wrench size={20} />
                </div>
                <h3>03. Tool Bay</h3>
                <p>Live schema inspector, registered tool catalog, and dry-run JSON execution sandbox.</p>
              </div>

              <div className="docking-bay-card" onClick={onLaunchWorkbench}>
                <div className="bay-icon-pill">
                  <Radar size={20} />
                </div>
                <h3>04. Flight Recorder</h3>
                <p>Live telemetry event stream, durable blackbox history, provenance previews, and human sign-off.</p>
              </div>
            </div>

            <div className="docking-action-cluster">
              <button
                onClick={onLaunchWorkbench}
                className="cosmic-launch-btn-large"
                aria-label="Launch interactive 3D workbench"
              >
                <span>Launch Interactive 3D Workbench</span>
                <ArrowUpRight size={20} />
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
