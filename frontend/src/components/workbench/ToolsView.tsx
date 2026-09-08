'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { ToolDefinition, ToolResult } from '@/lib/types';
import { Play, Wrench } from 'lucide-react';

export default function ToolsView() {
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [selectedTool, setSelectedTool] = useState<ToolDefinition | null>(null);
  const [argInput, setArgInput] = useState('{}');
  const [result, setResult] = useState<ToolResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .listTools()
      .then((res) => {
        setTools(res);
        if (res.length > 0) {
          setSelectedTool(res[0]);
          setArgInput(getDefaultArgs(res[0]));
        }
      })
      .catch((err) => {
        console.warn('Failed to load tools:', err);
        setTools([]);
      });
  }, []);

  const getDefaultArgs = (tool: ToolDefinition) => {
    if (tool.name === 'calculator') {
      return JSON.stringify({ operation: 'add', a: 15, b: 27 }, null, 2);
    }
    return '{}';
  };

  const handleSelectTool = (tool: ToolDefinition) => {
    setSelectedTool(tool);
    setArgInput(getDefaultArgs(tool));
    setResult(null);
  };

  const handleExecute = async () => {
    if (!selectedTool) return;
    setLoading(true);
    setResult(null);
    try {
      const parsedArgs = JSON.parse(argInput);
      const res = await api.executeTool(selectedTool.name, parsedArgs);
      setResult(res);
    } catch (e: any) {
      setResult({ success: false, output: null, error: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="workbench" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="workbench-title"><div className="eyebrow">Controlled capabilities</div>
        <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Tool Registry</h2>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Discover registered local tools, inspect their JSON schemas, and test execution.
        </p>
      </div>

      <div className="tool-grid">
        {/* Tool List */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Registered Tools ({tools.length})
          </h3>
          {tools.map((t) => (
            <button
              key={t.name}
              onClick={() => handleSelectTool(t)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: selectedTool?.name === t.name ? 'var(--accent-cyan)' : 'var(--border-subtle)',
                background: selectedTool?.name === t.name ? 'var(--bg-tertiary)' : 'transparent',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <Wrench size={16} color="var(--accent-cyan)" />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{t.name}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Execution Inspector */}
        {selectedTool && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 600 }}>{selectedTool.name}</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {selectedTool.description}
              </p>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                Arguments (JSON)
              </label>
              <textarea
                className="textarea"
                rows={5}
                style={{ fontFamily: 'monospace', fontSize: '12px', marginTop: '6px' }}
                value={argInput}
                onChange={(e) => setArgInput(e.target.value)}
              />
            </div>

            <button
              className="btn btn-primary"
              style={{ alignSelf: 'flex-start' }}
              onClick={handleExecute}
              disabled={loading}
            >
              <Play size={14} />
              <span>Execute Tool</span>
            </button>

            {result && (
              <div
                style={{
                  marginTop: '10px',
                  padding: '14px',
                  borderRadius: '8px',
                  background: 'var(--bg-tertiary)',
                  border: `1px solid ${result.success ? 'var(--accent-emerald)' : 'var(--accent-rose)'}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px' }}>
                  <span style={{ color: result.success ? 'var(--accent-emerald)' : 'var(--accent-rose)', fontWeight: 600 }}>
                    Status: {result.success ? 'SUCCESS' : 'FAILED'}
                  </span>
                  {result.execution_time_ms && (
                    <span style={{ color: 'var(--text-muted)' }}>
                      Latency: {result.execution_time_ms} ms
                    </span>
                  )}
                </div>
                <pre style={{ fontSize: '12px', overflowX: 'auto', color: 'var(--text-secondary)' }}>
                  {JSON.stringify(result.success ? result.output : result.error, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
