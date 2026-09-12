'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  ChevronDown,
  Cpu,
  Database,
  FileText,
  Image as ImageIcon,
  Loader2,
  Mic,
  Plus,
  Radio,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Terminal,
  Volume2,
  Wrench,
  X,
  Radar,
  Copy,
  Check,
  Calendar,
  Clock,
  Compass,
  GitBranch,
} from 'lucide-react';
import InteractiveCosmicChatCanvas from './InteractiveCosmicChatCanvas';
import { api, normalizeError } from '@/lib/api-client';
import { AppError, FlightRecord } from '@/lib/types';
import KnowledgeBay from '@/components/workbench/KnowledgeBay';
import MemoryFlowBay from '@/components/workbench/MemoryFlowBay';
import ToolBay from '@/components/workbench/ToolBay';
import FlightRecorderBay from '@/components/workbench/FlightRecorderBay';
import CommandCenterOverview from '@/components/workbench/CommandCenterOverview';
import ChatWorkspace from '@/components/chat/ChatWorkspace';
import DocumentPipelineWorkspace from '@/components/knowledge/DocumentPipelineWorkspace';
import AgentSquadWorkspace from '@/components/agents/AgentSquadWorkspace';
import WorkflowNodeCanvas from '@/components/visualizations/WorkflowNodeCanvas';
import ModelControlCenter from '@/components/models/ModelControlCenter';
import SettingsWorkspace from '@/components/settings/SettingsWorkspace';
import { sessionStore, WorkbenchBay } from '@/lib/session-store';

export type { WorkbenchBay };

interface MediaAttachment {
  id: string;
  type: 'image' | 'doc' | 'voice';
  name: string;
  size?: string;
  previewUrl?: string;
}

interface AgentChatLauncherProps {
  onBackToLanding: () => void;
  onOpenWorkbench?: (tab?: string) => void;
  availableModels?: string[];
  currentModel?: string;
  onModelChange?: (model: string) => void;
  activeBay?: WorkbenchBay;
  onBayChange?: (bay: WorkbenchBay) => void;
  onError?: (error: AppError) => void;
  lastCompletedTask?: string | null;
  onMissionCompleted?: (record: FlightRecord) => void;
}

const SUGGESTIONS = [
  {
    id: '1',
    tag: 'RADAR TELEMETRY',
    text: 'Analyze defense radar manual for subsystem telemetry anomalies',
    prompt:
      'Perform a deep inspection of the defense radar manual, retrieve telemetry specs, and identify any subsystem anomalies.',
  },
  {
    id: '2',
    tag: 'SECURITY AUDIT',
    text: 'Check the local calculator and review its execution trace',
    prompt:
      'Use the calculator tool to multiply 17 by 23. Report the result and any tool errors. This checks tool execution only; do not claim OS isolation or zero network traffic.',
  },
  {
    id: '3',
    tag: 'PDF PARSER',
    text: 'Ingest mission PDF and generate verified SHA-256 approval note',
    prompt:
      'Extract data from the latest mission parameters, execute document generation, and produce a cryptographically verified approval note.',
  },
  {
    id: '4',
    tag: 'ORBITAL MATH',
    text: 'Calculate orbital trajectory and fuel budget with sandbox math',
    prompt:
      'Use the sandbox calculator to compute orbital velocity at 400km LEO and calculate required delta-V reserve margin.',
  },
];

export default function AgentChatLauncher({
  onBackToLanding,
  onOpenWorkbench,
  availableModels = ['gemma4:e2b', 'gemma4:e4b-it-qat'],
  currentModel = 'gemma4:e2b',
  onModelChange,
  activeBay = 'mission',
  onBayChange,
  onError,
  lastCompletedTask,
  onMissionCompleted,
}: AgentChatLauncherProps) {
  const [currentBay, setCurrentBay] = useState<WorkbenchBay>(activeBay || 'mission');

  const isMissionActive = currentBay === 'mission' || currentBay === 'chat';
  const isKnowledgeActive = currentBay === 'documents' || currentBay === 'knowledge' || currentBay === 'memory';
  const isSquadActive = currentBay === 'agents' || currentBay === 'tools';
  const [isAirGapped, setIsAirGapped] = useState(true);

  useEffect(() => {
    if (activeBay) {
      setCurrentBay(activeBay);
      sessionStore.setActiveBay(activeBay);
    }
  }, [activeBay]);

  // Safe client hydration for stored bay and stored session
  useEffect(() => {
    const storedBay = sessionStore.getActiveBay(activeBay || 'mission');
    if (storedBay) setCurrentBay(storedBay);
    const storedSid = sessionStore.getActiveSessionId('SES-20260909-001');
    if (storedSid) setCurrentSessionId(storedSid);
  }, []);

  const handleSwitchBay = (bay: WorkbenchBay) => {
    setCurrentBay(bay);
    sessionStore.setActiveBay(bay);
    if (onBayChange) onBayChange(bay);
    if (onOpenWorkbench) onOpenWorkbench(bay);
  };

  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState(currentModel);
  const [attachments, setAttachments] = useState<MediaAttachment[]>([]);
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const [isAgentExecuting, setIsAgentExecuting] = useState(false);
  const [hasLaunched, setHasLaunched] = useState(false);
  const [agentSteps, setAgentSteps] = useState<string[]>([]);
  const [missionRecord, setMissionRecord] = useState<FlightRecord | null>(null);
  const [missionError, setMissionError] = useState<string | null>(null);
  const launchInFlight = useRef(false);
  const [agentAnswer, setAgentAnswer] = useState<string | null>(null);
  const [lastMissionPrompt, setLastMissionPrompt] = useState<string | null>(null);
  const [lastMissionAttachments, setLastMissionAttachments] = useState<MediaAttachment[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isCopied, setIsCopied] = useState(false);

  // Live Session Information State (Date, Time, Session ID)
  const [currentSessionId, setCurrentSessionId] = useState<string>('SES-20260909-001');
  const [liveDateStr, setLiveDateStr] = useState('2026-09-09');
  const [liveTimeStr, setLiveTimeStr] = useState('18:15:00 IST');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    setSelectedModel(currentModel);
  }, [currentModel]);

  // Live Date and Time ticker & Session sync
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setLiveDateStr(now.toISOString().split('T')[0]);
      setLiveTimeStr(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }) + ' IST',
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);

    // Fetch active session from backend and sync with sessionStore
    api
      .getCurrentSession()
      .then((s) => {
        if (s && s.session_id) {
          setCurrentSessionId(s.session_id);
          sessionStore.setActiveSessionId(s.session_id);
        }
      })
      .catch(() => {});

    // Listen to session changes and bay updates
    const unsubSession = sessionStore.onSessionChange((newId) => {
      setCurrentSessionId(newId);
    });
    const unsubBay = sessionStore.onBayChange((newBay) => {
      setCurrentBay(newBay);
    });

    return () => {
      clearInterval(interval);
      unsubSession();
      unsubBay();
    };
  }, []);

  // Voice recording simulation timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecordingVoice) {
      interval = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordingSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isRecordingVoice]);

  const handleImageSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const newAttach: MediaAttachment = {
      id: Math.random().toString(36).substring(7),
      type: 'image',
      name: file.name,
      size: `${(file.size / 1024).toFixed(0)} KB`,
      previewUrl: URL.createObjectURL(file),
    };
    setAttachments((prev) => [...prev, newAttach]);
    setIsAttachMenuOpen(false);
  };

  const handleDocSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const newAttach: MediaAttachment = {
      id: Math.random().toString(36).substring(7),
      type: 'doc',
      name: file.name,
      size: `${(file.size / 1024).toFixed(0)} KB`,
    };
    setAttachments((prev) => [...prev, newAttach]);
    setIsAttachMenuOpen(false);

    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      try {
        await api.uploadPdf(file);
      } catch (err) {
        // silent fallback
      }
    }
  };

  const handleToggleVoice = () => {
    if (isRecordingVoice) {
      setIsRecordingVoice(false);
      const voiceAttach: MediaAttachment = {
        id: Math.random().toString(36).substring(7),
        type: 'voice',
        name: `Voice_Directive_${recordingSeconds}s.wav`,
        size: `${recordingSeconds * 16} KB`,
      };
      setAttachments((prev) => [...prev, voiceAttach]);
      if (!prompt) {
        setPrompt('Transcribed voice mission directive: Verify orbital telemetry and local isolation.');
      }
    } else {
      setIsRecordingVoice(true);
      setIsAttachMenuOpen(false);
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  // Dispatch Mission Instantly
  const handleLaunchMission = async () => {
    if (launchInFlight.current || (!prompt.trim() && attachments.length === 0)) return;
    launchInFlight.current = true;
    setMissionRecord(null);
    setMissionError(null);
    setAgentAnswer(null);
    setElapsedMs(0);

    const userPrompt = prompt.trim() || 'Execute inspection mission based on attached payload.';
    setLastMissionPrompt(userPrompt);
    setLastMissionAttachments([...attachments]);
    setHasLaunched(true);
    setIsAgentExecuting(true);

    // Clear input
    setPrompt('');
    setAttachments([]);

    // Start timer
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startTime);
    }, 50);

    setAgentSteps(['Request submitted. Waiting for recorded backend execution.']);

    try {
      const result = await api.runFlightMission(userPrompt, selectedModel, 'NO_EGRESS', undefined, 5);
      setMissionRecord(result);
      setAgentAnswer(result.final_response || 'No final response was recorded. Inspect the flight log.');
      if (result.status === 'failed') {
        setMissionError(result.errors.map((error) => error.error_message).join('; ') || 'Backend reported mission failure.');
      }
      onMissionCompleted?.(result);
    } catch (err) {
      const error = normalizeError(err);
      setMissionError(error.message);
      onError?.(error);
    } finally {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      setElapsedMs(Date.now() - startTime);
      setIsAgentExecuting(false);
      launchInFlight.current = false;
    }
  };

  const handleResetMission = () => {
    if (launchInFlight.current) return;
    setMissionRecord(null);
    setMissionError(null);
    setHasLaunched(false);
    setIsAgentExecuting(false);
    setAgentSteps([]);
    setAgentAnswer(null);
    setElapsedMs(0);
    setIsCopied(false);
  };

  const handleCopyReport = () => {
    if (agentAnswer) {
      navigator.clipboard.writeText(agentAnswer);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  return (
    <div className="agent-chat-launcher-root">
      {/* Photorealistic 3D Celestial Canvas with Animated Stars & Terran Planet */}
      <InteractiveCosmicChatCanvas />

      {/* Top Floating Aerospace Control Bar */}
      <header className="launcher-topbar">
        <div className="launcher-topbar-left">
          <button
            onClick={onBackToLanding}
            className="launcher-nav-btn"
            aria-label="Exit to 3D Cosmic Orbit"
            title="Return to 3D Cosmic Orbit"
          >
            <ArrowLeft size={14} />
            <span>Orbit</span>
          </button>

          <div className="launcher-wordmark">
            <span className="launcher-wordmark-icon">
              <Sparkles size={15} />
            </span>
            <span>SOVEREIGN</span>
            <span className="slash">/</span>
            <span>CORE</span>
          </div>
        </div>

        {/* Center Single Unified Cybernetic Command Bar */}
        <nav className="launcher-bay-switcher" aria-label="Sovereign Command Workspaces">
          <button
            className={`bay-switch-pill ${currentBay === 'overview' ? 'active' : ''}`}
            onClick={() => handleSwitchBay('overview')}
            title="Sovereign Command Center Overview"
          >
            <Compass size={13} />
            <span>Overview</span>
          </button>

          <button
            className={`bay-switch-pill ${isMissionActive ? 'active' : ''}`}
            onClick={() => handleSwitchBay('mission')}
            title="01 Mission Intelligence Cockpit & 3D Celestial Directive Intake"
          >
            <Radio size={13} />
            <span>01 Mission</span>
          </button>

          <button
            className={`bay-switch-pill ${isKnowledgeActive ? 'active' : ''}`}
            onClick={() => {
              if (!['documents', 'knowledge', 'memory'].includes(currentBay)) {
                handleSwitchBay('documents');
              }
            }}
            title="02 Knowledge Base: Ingestion Pipeline, Vector Space & Memory Flow"
          >
            <Database size={13} />
            <span>02 Knowledge</span>
          </button>

          <button
            className={`bay-switch-pill ${isSquadActive ? 'active' : ''}`}
            onClick={() => {
              if (!['agents', 'tools'].includes(currentBay)) {
                handleSwitchBay('agents');
              }
            }}
            title="03 Autonomous Squad: Agent Command Grid & Tool Sandbox"
          >
            <Sparkles size={13} />
            <span>03 Squad</span>
          </button>

          <button
            className={`bay-switch-pill ${currentBay === 'workflows' ? 'active' : ''}`}
            onClick={() => handleSwitchBay('workflows')}
            title="04 Autonomous Mission Orchestration Graph (LangGraph)"
          >
            <GitBranch size={13} />
            <span>04 Workflows</span>
          </button>

          <button
            className={`bay-switch-pill ${currentBay === 'recorder' ? 'active' : ''}`}
            onClick={() => handleSwitchBay('recorder')}
            title="05 Flight Recorder Blackbox Telemetry & Cryptographic Verification"
          >
            <Radar size={13} />
            <span>05 Flight Log</span>
          </button>

          <button
            className={`bay-switch-pill ${currentBay === 'models' ? 'active' : ''}`}
            onClick={() => handleSwitchBay('models')}
            title="06 Local Model Control Center & Ollama Runtimes"
          >
            <Cpu size={13} />
            <span>06 Models</span>
          </button>
        </nav>

        {/* Right Status Badge & Dynamic Model Selector (Exact Image 2) */}
        <div className="launcher-topbar-right">
          <button
            type="button"
            className={`launcher-airgap-switch ${isAirGapped ? 'enforced' : 'unlocked'}`}
            onClick={() => setIsAirGapped(!isAirGapped)}
            role="switch"
            aria-checked={isAirGapped}
            title={
              isAirGapped
                ? 'Air-Gap Enforced: Zero external network egress permitted. Click to toggle.'
                : 'Permissive Mode: Outbound connectivity unblocked. Click to enforce air-gap.'
            }
          >
            <span className={`airgap-switch-track ${isAirGapped ? 'active' : ''}`}>
              <span className="airgap-switch-knob" />
            </span>
            <span className="airgap-switch-label">
              {'LOCAL EXECUTION // EGRESS UNMEASURED'}
            </span>
          </button>

          <div className="model-selector-chip">
            <Bot size={13} className="text-cyan" />
            <span>MODEL:</span>
            <select
              className="model-select-dropdown"
              value={selectedModel}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedModel(val);
                if (onModelChange) onModelChange(val);
              }}
              aria-label="Select AI reasoning model"
            >
              {availableModels.map((m) => (
                <option key={m} value={m} style={{ background: '#030d22', color: '#fff' }}>
                  {m.replace('gemma4:', 'Gemma ')}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageSelected}
        accept="image/*"
        style={{ display: 'none' }}
      />
      <input
        type="file"
        ref={docInputRef}
        onChange={handleDocSelected}
        accept=".pdf,.doc,.docx,.txt"
        style={{ display: 'none' }}
      />

      {/* 01 Mission Center Stage / Chat Cockpit */}
      <div
        className="mission-stage-shell flex flex-col w-full relative z-20"
        style={{ display: isMissionActive ? 'flex' : 'none' }}
      >
        <div className="workspace-subnav-bar">
          <div className="workspace-subnav-cluster" role="tablist" aria-label="Mission Interface Mode">
            <button
              role="tab"
              aria-selected={currentBay === 'mission'}
              className={`workspace-subnav-pill ${currentBay === 'mission' ? 'active' : ''}`}
              onClick={() => handleSwitchBay('mission')}
              title="Interactive 3D Celestial Mission Launcher"
            >
              <Radio size={12} />
              <span>Cosmic Mission Launcher</span>
            </button>
            <button
              role="tab"
              aria-selected={currentBay === 'chat'}
              className={`workspace-subnav-pill ${currentBay === 'chat' ? 'active' : ''}`}
              onClick={() => handleSwitchBay('chat')}
              title="Streaming Contextual Chat Cockpit"
            >
              <Bot size={12} />
              <span>Chat Cockpit (Streaming)</span>
            </button>
          </div>
        </div>

        <div style={{ display: currentBay === 'mission' ? 'block' : 'none' }}>
          <div className="launcher-center-stage">
        {!hasLaunched ? (
          /* ============================================================ */
          /* ULTRA-CLEAN MODERN PROMPT & MISSION DISPATCH CONSOLE          */
          /* ============================================================ */
          <div className="gemini-search-container">
            {/* Live Session Temporal HUD (Session ID, Date, Time, Memory Flow) */}
            <div className="session-temporal-hud-strip" suppressHydrationWarning>
              <div className="session-hud-item" suppressHydrationWarning>
                <span className="session-status-dot" />
                <span className="session-id-tag" suppressHydrationWarning>
                  SESSION: <strong suppressHydrationWarning>{currentSessionId}</strong>
                </span>
              </div>
              <span className="telemetry-dot">•</span>
              <div className="session-hud-item" suppressHydrationWarning>
                <Calendar size={12} className="text-cyan" />
                <span suppressHydrationWarning>
                  DATE: <strong suppressHydrationWarning>{liveDateStr}</strong>
                </span>
              </div>
              <span className="telemetry-dot">•</span>
              <div className="session-hud-item" suppressHydrationWarning>
                <Clock size={12} className="text-emerald" />
                <span suppressHydrationWarning>
                  TIME: <strong className="font-mono" suppressHydrationWarning>{liveTimeStr}</strong>
                </span>
              </div>
              <span className="telemetry-dot">•</span>
              <button
                type="button"
                onClick={() => handleSwitchBay('memory')}
                className="memory-flow-quick-link"
                title="Inspect the 4 Memory Types & Context Builder"
              >
                <GitBranch size={12} className="text-cyan" />
                <span>Memory Flow &rarr;</span>
              </button>
            </div>

            {/* Mission Telemetry Micro-HUD */}
            <div className="launcher-telemetry-strip">
              <div className="telemetry-item">
                <ShieldCheck size={13} className="text-emerald" />
                <span>EGRESS: <strong>UNMEASURED</strong></span>
              </div>
              <span className="telemetry-dot">•</span>
              <div className="telemetry-item">
                <Database size={13} className="text-cyan" />
                <span>MEMORY: <strong>HNSW VECTOR READY</strong></span>
              </div>
              <span className="telemetry-dot">•</span>
              <div className="telemetry-item">
                <Cpu size={13} className="text-amber" />
                <span>CORE: <strong>{selectedModel.replace('gemma4:', 'GEMMA ')}</strong></span>
              </div>
            </div>

            {/* Main Clean Heading (Unobstructed) */}
            <div className="launcher-hero-text">
              <h1 className="gemini-heading">Where should we start?</h1>
              <p className="gemini-subheading">
                Direct local intelligence • Air-gapped tool execution • Auditable flight provenance
              </p>
            </div>

            {/* Glowing Command Search Pill Box */}
            <div className={`gemini-pill-box ${isRecordingVoice ? 'recording' : ''}`}>
              {/* Attachment Plus Menu */}
              <div className="attach-button-wrapper">
                <button
                  type="button"
                  className={`attach-plus-btn ${isAttachMenuOpen ? 'active' : ''}`}
                  onClick={() => setIsAttachMenuOpen((prev) => !prev)}
                  aria-label="Attach documents or payload"
                >
                  <Plus size={19} />
                </button>

                {isAttachMenuOpen && (
                  <div className="attachment-dropdown-menu">
                    <button
                      type="button"
                      className="menu-item"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <ImageIcon size={15} className="text-cyan" />
                      <span>Photos & Images</span>
                    </button>
                    <button
                      type="button"
                      className="menu-item"
                      onClick={() => docInputRef.current?.click()}
                    >
                      <FileText size={15} className="text-amber" />
                      <span>Documents & PDFs</span>
                    </button>
                    <button
                      type="button"
                      className="menu-item"
                      onClick={handleToggleVoice}
                    >
                      <Mic size={15} className="text-emerald" />
                      <span>Voice Directive</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Input Area */}
              <div className="gemini-input-wrapper">
                {attachments.length > 0 && (
                  <div className="attachments-chip-strip">
                    {attachments.map((a) => (
                      <div key={a.id} className="attachment-chip">
                        {a.type === 'image' && <ImageIcon size={12} className="text-cyan" />}
                        {a.type === 'doc' && <FileText size={12} className="text-amber" />}
                        {a.type === 'voice' && <Volume2 size={12} className="text-emerald" />}
                        <span className="chip-name">{a.name}</span>
                        <button
                          type="button"
                          onClick={() => removeAttachment(a.id)}
                          className="chip-remove"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {isRecordingVoice ? (
                  <div className="voice-recording-hud">
                    <div className="pulse-red-dot" />
                    <span className="recording-text">
                      Recording Voice Directive ({recordingSeconds}s)...
                    </span>
                    <div className="audio-wave-bars">
                      <span className="wave-bar bar-1" />
                      <span className="wave-bar bar-2" />
                      <span className="wave-bar bar-3" />
                      <span className="wave-bar bar-4" />
                      <span className="wave-bar bar-5" />
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleVoice}
                      className="stop-voice-btn"
                    >
                      Complete
                    </button>
                  </div>
                ) : (
                  <input
                    ref={inputRef}
                    type="text"
                    className="gemini-text-input"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleLaunchMission();
                    }}
                    placeholder="Ask Sovereign / Launch air-gapped mission..."
                    aria-label="Mission prompt input"
                    autoFocus
                  />
                )}
              </div>

              {/* Right Cluster: Model Switcher & Instant Dispatch Button */}
              <div className="gemini-right-cluster">
                <div className="gemini-model-selector">
                  <Bot size={13} className="text-cyan" />
                  <select
                    value={selectedModel}
                    onChange={(e) => {
                      setSelectedModel(e.target.value);
                      if (onModelChange) onModelChange(e.target.value);
                    }}
                    aria-label="Select reasoning model"
                  >
                    {availableModels.map((m) => (
                      <option key={m} value={m} style={{ background: '#050f24', color: '#fff' }}>
                        {m.replace('gemma4:', 'Gemma ')}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={13} className="dropdown-arrow" />
                </div>

                <button
                  type="button"
                  className={`gemini-mic-btn ${isRecordingVoice ? 'recording' : ''}`}
                  onClick={handleToggleVoice}
                  aria-label="Voice input"
                >
                  <Mic size={17} />
                </button>

                <button
                  type="button"
                  className={`gemini-send-btn ${
                    prompt.trim() || attachments.length > 0 ? 'active' : ''
                  }`}
                  onClick={handleLaunchMission}
                  disabled={!prompt.trim() && attachments.length === 0}
                  aria-label="Dispatch mission"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>

            {/* Quick Directive Suggestions Cards */}
            <div className="gemini-suggestions-grid">
              {SUGGESTIONS.map((item) => (
                <button
                  key={item.id}
                  className="suggestion-card"
                  onClick={() => {
                    setPrompt(item.prompt);
                    inputRef.current?.focus();
                  }}
                >
                  <div className="suggestion-card-header">
                    <span className="suggestion-tag">{item.tag}</span>
                    <ArrowRight size={13} className="suggestion-arrow" />
                  </div>
                  <p className="suggestion-card-text">{item.text}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* ============================================================ */
          /* ACTIVE MISSION EXECUTION & DETERMINISTIC FLIGHT REPORT        */
          /* ============================================================ */
          <div className="active-mission-thread-card">
            {/* Header Telemetry */}
            <div className="thread-header">
              <div className="thread-badge">
                <span className="pulse-cyan-dot" />
                <span>{isAgentExecuting ? 'MISSION EXECUTING' : missionError ? 'MISSION FAILED' : missionRecord?.status === 'completed' ? 'EXECUTION FINISHED // REVIEW RESULT' : 'MISSION STATUS UNKNOWN'}</span>
              </div>
              <div className="thread-timer">
                <Terminal size={14} className="text-cyan" />
                <span>LATENCY: {(elapsedMs / 1000).toFixed(2)}s</span>
                <span className="network-tag" title="No host network traffic measurement is available.">EGRESS UNMEASURED</span>
              </div>
            </div>

            {/* User Directive Bubble */}
            <div className="thread-user-bubble">
              <span className="bubble-label">DIRECTIVE:</span>
              <p className="user-prompt-text">{lastMissionPrompt}</p>

              {lastMissionAttachments.length > 0 && (
                <div className="bubble-attachments">
                  {lastMissionAttachments.map((a) => (
                    <div key={a.id} className="attachment-badge">
                      {a.type === 'image' && <ImageIcon size={13} />}
                      {a.type === 'doc' && <FileText size={13} />}
                      {a.type === 'voice' && <Volume2 size={13} />}
                      <span>{a.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Live Agent Reasoning Steps */}
            {isAgentExecuting && (
              <div className="thread-thinking-panel">
                <div className="thinking-indicator">
                  <Loader2 size={16} className="spinner text-cyan" />
                  <span>Awaiting backend mission result...</span>
                </div>
                <div className="thinking-step-list">
                  {agentSteps.map((step, idx) => (
                    <div key={idx} className="thinking-step-item">
                      <Clock size={13} />
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {missionError && <div className="thread-response-bubble" role="alert">Mission failed: {missionError}</div>}
            {missionRecord && (
              <div className="thread-thinking-panel">
                <p>Record: {missionRecord.task_id} · Backend status: {missionRecord.status}</p>
                <p>Recorded tool calls: {missionRecord.tools_called.length} · Retrieved sources: {missionRecord.retrieved_sources.length}</p>
                <p>Execution status does not verify the answer or host network isolation.</p>
              </div>
            )}
            {/* Final Agent Answer */}
            {agentAnswer && (
              <div className="thread-response-bubble">
                <div className="response-header">
                  <div className="response-title-cluster">
                    <Bot size={17} className="text-cyan" />
                    <span>SOVEREIGN AGENT MISSION REPORT ({missionRecord?.model || selectedModel})</span>
                  </div>
                  <div className="response-actions-cluster">
                    <button
                      onClick={handleCopyReport}
                      className="copy-report-btn"
                      aria-label="Copy report to clipboard"
                    >
                      {isCopied ? <Check size={13} className="text-emerald" /> : <Copy size={13} />}
                      <span>{isCopied ? 'Copied' : 'Copy'}</span>
                    </button>
                    <span className="verified-seal">OUTPUT UNVERIFIED</span>
                  </div>
                </div>

                <div className="response-content-markdown">
                  {agentAnswer.split('\n').map((line, idx) => {
                    if (line.startsWith('### ')) {
                      return <h3 key={idx}>{line.replace('### ', '')}</h3>;
                    }
                    if (line.startsWith('- ')) {
                      const parts = line.replace('- ', '').split(':');
                      return (
                        <li key={idx}>
                          <strong>{parts[0]}:</strong>
                          {parts.slice(1).join(':')}
                        </li>
                      );
                    }
                    if (line.startsWith('*') && line.endsWith('*')) {
                      return <p key={idx} className="italic-note">{line.replaceAll('*', '')}</p>;
                    }
                    return <p key={idx}>{line}</p>;
                  })}
                </div>
              </div>
            )}

            {/* Action Footer */}
            <div className="thread-actions-footer">
              <button
                onClick={handleResetMission}
                disabled={isAgentExecuting}
                className="reset-mission-btn"
                aria-label="Launch a new directive"
              >
                <RotateCcw size={15} />
                <span>New Mission</span>
              </button>

              <button
                onClick={() => handleSwitchBay('recorder')}
                disabled={!missionRecord}
                className="recorder-inspect-btn"
                aria-label="Inspect in Flight Recorder"
              >
                <span>Inspect Flight Log</span>
                <ArrowUpRight size={15} />
              </button>
            </div>
          </div>
        )}
          </div>
        </div>

        <div
          style={{ display: currentBay === 'chat' ? 'block' : 'none' }}
          className="launcher-bay-fullwidth-stage"
        >
          <ChatWorkspace
            currentModel={selectedModel}
            availableModels={availableModels}
            onModelChange={onModelChange}
            onError={onError}
          />
        </div>
      </div>

      {/* 02 Knowledge Base Stage (Unified Ingestion Pipeline, Vector Store & Memory Flow) */}
      <div
        className="flex flex-col w-full"
        style={{ display: isKnowledgeActive ? 'flex' : 'none' }}
      >
        <div className="workspace-subnav-bar">
          <div className="workspace-subnav-cluster" role="tablist" aria-label="Knowledge Base Sub-Views">
            <button
              role="tab"
              aria-selected={currentBay === 'documents'}
              className={`workspace-subnav-pill ${currentBay === 'documents' ? 'active' : ''}`}
              onClick={() => handleSwitchBay('documents')}
              title="Deterministic Document Ingestion Pipeline"
            >
              <FileText size={12} />
              <span>Ingestion Pipeline</span>
            </button>
            <button
              role="tab"
              aria-selected={currentBay === 'knowledge'}
              className={`workspace-subnav-pill ${currentBay === 'knowledge' ? 'active' : ''}`}
              onClick={() => handleSwitchBay('knowledge')}
              title="Semantic Vector Space (ChromaDB / Qdrant)"
            >
              <Database size={12} />
              <span>Vector Space (Chroma/Qdrant)</span>
            </button>
            <button
              role="tab"
              aria-selected={currentBay === 'memory'}
              className={`workspace-subnav-pill ${currentBay === 'memory' ? 'active' : ''}`}
              onClick={() => handleSwitchBay('memory')}
              title="Four-Tier Cognitive Memory Flow"
            >
              <Cpu size={12} />
              <span>Memory Flow (Cognitive)</span>
            </button>
          </div>
        </div>

        <div
          style={{ display: currentBay === 'documents' ? 'block' : 'none' }}
          className="launcher-bay-fullwidth-stage"
        >
          <DocumentPipelineWorkspace onError={onError} />
        </div>

        <div
          style={{ display: currentBay === 'knowledge' ? 'block' : 'none' }}
          className="launcher-bay-fullwidth-stage"
        >
          <KnowledgeBay onError={(err) => (onError ? onError(err) : console.error(err))} />
        </div>

        <div
          style={{ display: currentBay === 'memory' ? 'block' : 'none' }}
          className="launcher-bay-fullwidth-stage"
        >
          <MemoryFlowBay onError={(err) => (onError ? onError(err) : console.error(err))} />
        </div>
      </div>

      {/* 03 Autonomous Squad Stage (Unified Agent Command Grid & Tool Sandbox) */}
      <div
        className="flex flex-col w-full"
        style={{ display: isSquadActive ? 'flex' : 'none' }}
      >
        <div className="workspace-subnav-bar">
          <div className="workspace-subnav-cluster" role="tablist" aria-label="Squad Workspace Sub-Views">
            <button
              role="tab"
              aria-selected={currentBay === 'agents'}
              className={`workspace-subnav-pill ${currentBay === 'agents' ? 'active' : ''}`}
              onClick={() => handleSwitchBay('agents')}
              title="Autonomous Multi-Agent Command Grid"
            >
              <Sparkles size={12} />
              <span>Agent Command Grid</span>
            </button>
            <button
              role="tab"
              aria-selected={currentBay === 'tools'}
              className={`workspace-subnav-pill ${currentBay === 'tools' ? 'active' : ''}`}
              onClick={() => handleSwitchBay('tools')}
              title="Controlled Zero-Egress Tool Execution Sandbox"
            >
              <Wrench size={12} />
              <span>Tool Sandbox & Registry</span>
            </button>
          </div>
        </div>

        <div
          style={{ display: currentBay === 'agents' ? 'block' : 'none' }}
          className="launcher-bay-fullwidth-stage"
        >
          <AgentSquadWorkspace currentModel={selectedModel} onError={onError} />
        </div>

        <div
          style={{ display: currentBay === 'tools' ? 'block' : 'none' }}
          className="launcher-bay-fullwidth-stage"
        >
          <ToolBay onError={(err) => (onError ? onError(err) : console.error(err))} />
        </div>
      </div>

      {/* Sovereign Command Center Overview Stage */}
      <div
        style={{ display: currentBay === 'overview' ? 'block' : 'none' }}
        className="launcher-bay-fullwidth-stage"
      >
        <CommandCenterOverview
          onNavigateWorkspace={(bay) => handleSwitchBay(bay as WorkbenchBay)}
          onError={onError}
          currentModel={selectedModel}
        />
      </div>

      {/* 04 Autonomous Mission Orchestration Node Graph Stage */}
      <div
        style={{ display: currentBay === 'workflows' ? 'block' : 'none' }}
        className="launcher-bay-fullwidth-stage"
      >
        <WorkflowNodeCanvas />
      </div>

      {/* 05 Flight Log Recorder Stage (Full Width, Mission Telemetry & Flight Audit) */}
      <div
        style={{ display: currentBay === 'recorder' ? 'block' : 'none' }}
        className="launcher-bay-fullwidth-stage"
      >
        <FlightRecorderBay
          onError={(err) => (onError ? onError(err) : console.error(err))}
          selectedTaskId={missionRecord?.task_id || lastCompletedTask}
        />
      </div>

      {/* 06 Local Model Control Center Stage */}
      <div
        style={{ display: currentBay === 'models' ? 'block' : 'none' }}
        className="launcher-bay-fullwidth-stage"
      >
        <ModelControlCenter
          currentModel={selectedModel}
          onModelChange={onModelChange}
          onError={onError}
        />
      </div>

      {/* Security Governance & Air-Gap Settings Stage */}
      <div
        style={{ display: currentBay === 'settings' ? 'block' : 'none' }}
        className="launcher-bay-fullwidth-stage"
      >
        <SettingsWorkspace />
      </div>
    </div>
  );
}
