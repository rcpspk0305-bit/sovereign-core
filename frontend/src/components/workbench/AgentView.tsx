'use client';

import React, { useState } from 'react';
import { api } from '@/lib/api-client';
import { AgentResult } from '@/lib/types';
import {
  Bot,
  Play,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  FileSearch,
  Calculator,
  FileText,
  Lock,
  Copy,
  Check,
} from 'lucide-react';

interface AgentViewProps {
  model: string;
}

export default function AgentView({ model }: AgentViewProps) {
  const [prompt, setPrompt] = useState(
    'Retrieve document details about Apollo99, calculate (82 - 75) temperature delta, and generate an inspection report with citations.'
  );
  const [maxSteps, setMaxSteps] = useState<number>(5);
  const [result, setResult] = useState<AgentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedDoc, setCopiedDoc] = useState(false);

  const presets = [
    {
      label: 'Inspect & Generate Report',
      prompt:
        'Retrieve document details about Apollo99, calculate (82 - 75) temperature delta, and generate an inspection report with citations.',
    },
    {
      label: 'Document Verification',
      prompt:
        'Search the knowledge base for air-gapped security guidelines and summarize key findings.',
    },
    {
      label: 'Deterministic Calculation',
      prompt:
        'Use the calculator tool to compute ((145 * 12) + 360) / 4 and show your work.',
    },
  ];

  const handleRunAgent = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setResult(null);
    setCopiedDoc(false);
    try {
      const res = await api.runAgent(prompt.trim(), model || undefined, maxSteps);
      setResult(res);
    } catch (e: any) {
      setResult({
        session_id: 'err',
        final_response: `Agent run error: ${e.message}`,
        steps: [],
        success: false,
        error: e.message,
      });
    } finally {
      setLoading(false);
    }
  };

  // Check if a document generation step occurred
  const generatedDocStep = result?.steps.find(
    (s) => s.tool_name === 'document_generation' && s.tool_result?.success
  );
  const generatedDocContent =
    generatedDocStep?.tool_result?.output?.document_content;

  const handleCopyDoc = () => {
    if (!generatedDocContent) return;
    const text =
      typeof generatedDocContent === 'string'
        ? generatedDocContent
        : JSON.stringify(generatedDocContent, null, 2);
    navigator.clipboard.writeText(text);
    setCopiedDoc(true);
    setTimeout(() => setCopiedDoc(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header & Security Policy */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Inspection-Analysis Agent</h2>
            <span
              className="badge"
              style={{
                background: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--accent-emerald)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <ShieldCheck size={12} />
              Controlled & Air-Gapped
            </span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Single controlled reasoning agent bounded to explicitly authorized local tools.
          </p>
        </div>

        {/* Security Policy Chips */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <span
            className="badge"
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              color: 'var(--accent-rose)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Lock size={12} />
            No Shell Access
          </span>
          <span
            className="badge"
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              color: 'var(--accent-rose)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Lock size={12} />
            No Internet Access
          </span>
        </div>
      </div>

      {/* Authorized Tools Bar */}
      <div
        className="card"
        style={{
          background: 'var(--bg-secondary)',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          Authorized Tools:
        </span>
        <span
          className="badge"
          style={{
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 8px',
          }}
        >
          <FileSearch size={13} color="var(--accent-cyan)" />
          <code>document_retrieval</code>
        </span>
        <span
          className="badge"
          style={{
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 8px',
          }}
        >
          <Calculator size={13} color="var(--accent-amber)" />
          <code>calculator</code>
        </span>
        <span
          className="badge"
          style={{
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 8px',
          }}
        >
          <FileText size={13} color="var(--accent-emerald)" />
          <code>document_generation</code>
        </span>
      </div>

      {/* Directives & Configuration */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label htmlFor="agent-objective-input" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
            Inspection Objective / Directive
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label htmlFor="agent-step-budget" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Step Budget: <strong>{maxSteps}</strong> steps
            </label>
            <input
              id="agent-step-budget"
              type="range"
              min="1"
              max="10"
              value={maxSteps}
              aria-label="Step Budget slider"
              onChange={(e) => setMaxSteps(parseInt(e.target.value, 10) || 5)}
              style={{ width: '90px', accentColor: 'var(--accent-cyan)' }}
            />
          </div>
        </div>

        {/* Presets */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {presets.map((p, idx) => (
            <button
              key={idx}
              className="btn btn-secondary"
              aria-label={`Apply preset ${p.label}`}
              style={{ fontSize: '11px', padding: '4px 10px' }}
              onClick={() => setPrompt(p.prompt)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <textarea
          id="agent-objective-input"
          aria-label="Inspection Objective or Directive"
          className="textarea"
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe what the inspection agent should verify, calculate, and document..."
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            className="btn btn-primary"
            onClick={handleRunAgent}
            aria-label="Execute Controlled Agent"
            disabled={loading || !prompt.trim()}
          >
            <Play size={14} />
            <span>{loading ? 'Agent Executing...' : 'Execute Controlled Agent'}</span>
          </button>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Model: <strong>{model || 'gemma4:e2b'}</strong>
          </span>
        </div>
      </div>

      {/* Results & Trace */}
      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Final Response */}
          <div
            className="card"
            style={{
              borderLeft: `4px solid ${result.success ? 'var(--accent-emerald)' : 'var(--accent-rose)'}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              {result.success ? (
                <CheckCircle2 size={18} color="var(--accent-emerald)" />
              ) : (
                <AlertCircle size={18} color="var(--accent-rose)" />
              )}
              <h3 style={{ fontSize: '14px', fontWeight: 600 }}>Inspection Synthesis</h3>
              {result.total_latency_ms && (
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  Total Latency: {result.total_latency_ms} ms | Steps: {result.steps.length}
                </span>
              )}
            </div>
            <div style={{ fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
              {result.final_response}
            </div>
          </div>

          {/* Generated Document Card if present */}
          {generatedDocContent && (
            <div
              className="card"
              style={{
                border: '1px solid rgba(16, 185, 129, 0.4)',
                background: 'rgba(16, 185, 129, 0.03)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={16} color="var(--accent-emerald)" />
                  <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-emerald)' }}>
                    Generated Inspection Document
                  </h4>
                </div>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: '11px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  onClick={handleCopyDoc}
                >
                  {copiedDoc ? <Check size={12} color="var(--accent-emerald)" /> : <Copy size={12} />}
                  <span>{copiedDoc ? 'Copied' : 'Copy Document'}</span>
                </button>
              </div>
              <pre
                style={{
                  background: 'var(--bg-tertiary)',
                  padding: '12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  maxHeight: '260px',
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {typeof generatedDocContent === 'string'
                  ? generatedDocContent
                  : JSON.stringify(generatedDocContent, null, 2)}
              </pre>
            </div>
          )}

          {/* Reasoning Steps */}
          {result.steps.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Controlled Execution Trace ({result.steps.length} Steps)
              </h4>
              {result.steps.map((step) => {
                const isBlocked =
                  step.tool_result && !step.tool_result.success && step.tool_result.error?.includes('Security policy violation');

                return (
                  <div
                    key={step.step_number}
                    className="card"
                    style={{
                      padding: '12px 14px',
                      borderLeft: isBlocked ? '3px solid var(--accent-rose)' : undefined,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
                      <span>Step #{step.step_number}</span>
                      {step.tool_name && (
                        <span
                          className={`badge ${isBlocked ? 'badge-danger' : 'badge-warning'}`}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          {isBlocked ? <ShieldAlert size={12} /> : null}
                          Tool: {step.tool_name}
                        </span>
                      )}
                    </div>
                    {step.thought && (
                      <div style={{ fontSize: '13px', marginTop: '6px', color: 'var(--text-secondary)' }}>
                        <strong>Thought:</strong> {step.thought}
                      </div>
                    )}
                    {step.tool_arguments && Object.keys(step.tool_arguments).length > 0 && (
                      <div style={{ fontSize: '11px', marginTop: '4px', color: 'var(--text-muted)' }}>
                        <code>Args: {JSON.stringify(step.tool_arguments)}</code>
                      </div>
                    )}
                    {step.observation && (
                      <div
                        style={{
                          fontSize: '12px',
                          marginTop: '8px',
                          background: isBlocked ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-tertiary)',
                          color: isBlocked ? 'var(--accent-rose)' : undefined,
                          padding: '8px 10px',
                          borderRadius: '4px',
                          maxHeight: '180px',
                          overflowY: 'auto',
                        }}
                      >
                        <strong>Observation:</strong> {step.observation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
