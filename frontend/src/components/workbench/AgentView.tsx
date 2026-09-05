'use client';

import React, { useState } from 'react';
import { api } from '@/lib/api-client';
import { AgentResult } from '@/lib/types';
import { Bot, Play, CheckCircle2, AlertCircle } from 'lucide-react';

interface AgentViewProps {
  model: string;
}

export default function AgentView({ model }: AgentViewProps) {
  const [prompt, setPrompt] = useState('Use the calculator tool to compute (25 * 4) + 50.');
  const [result, setResult] = useState<AgentResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRunAgent = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await api.runAgent(prompt.trim(), model || undefined);
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Agent Reasoning Loop</h2>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Execute multi-step goal execution with step tracing and automated tool dispatching.
        </p>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
          User Directive
        </label>
        <textarea
          className="textarea"
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe what the agent should accomplish..."
        />
        <button
          className="btn btn-primary"
          style={{ alignSelf: 'flex-start' }}
          onClick={handleRunAgent}
          disabled={loading || !prompt.trim()}
        >
          <Play size={14} />
          <span>{loading ? 'Agent Reasoning...' : 'Launch Agent Loop'}</span>
        </button>
      </div>

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
              <h3 style={{ fontSize: '14px', fontWeight: 600 }}>Final Agent Synthesis</h3>
              {result.total_latency_ms && (
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  Total Latency: {result.total_latency_ms} ms
                </span>
              )}
            </div>
            <div style={{ fontSize: '14px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
              {result.final_response}
            </div>
          </div>

          {/* Reasoning Steps */}
          {result.steps.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h4 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Execution Trace ({result.steps.length} Steps)
              </h4>
              {result.steps.map((step) => (
                <div key={step.step_number} className="card" style={{ padding: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)' }}>
                    <span>Step #{step.step_number}</span>
                    {step.tool_name && (
                      <span className="badge badge-warning">Tool: {step.tool_name}</span>
                    )}
                  </div>
                  {step.thought && (
                    <div style={{ fontSize: '13px', marginTop: '6px', color: 'var(--text-secondary)' }}>
                      <strong>Thought:</strong> {step.thought}
                    </div>
                  )}
                  {step.observation && (
                    <div style={{ fontSize: '12px', marginTop: '6px', background: 'var(--bg-tertiary)', padding: '8px', borderRadius: '4px' }}>
                      <strong>Observation:</strong> {step.observation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
