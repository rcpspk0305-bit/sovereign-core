'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Play, Shield, Terminal, Wrench, XCircle } from 'lucide-react';
import { api, normalizeError } from '@/lib/api-client';
import { AppError, ToolDefinition, ToolResult } from '@/lib/types';
import { apply3DTilt, reset3DTilt } from '@/lib/animations';

interface ToolBayProps {
  onError: (error: AppError) => void;
}

export default function ToolBay({ onError }: ToolBayProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [selectedTool, setSelectedTool] = useState<ToolDefinition | null>(null);
  const [paramInput, setParamInput] = useState<string>('{}');
  const [executing, setExecuting] = useState(false);
  const [execResult, setExecResult] = useState<ToolResult | null>(null);

  useEffect(() => {
    api
      .listTools()
      .then((data) => {
        setTools(data);
        if (data.length > 0) {
          setSelectedTool(data[0]);
          setDefaultParams(data[0]);
        }
      })
      .catch((err) => {
        onError(normalizeError(err, 'VALIDATION_ERROR'));
      });
  }, []);

  const setDefaultParams = (tool: ToolDefinition) => {
    const props = tool.parameters?.properties || {};
    const sample: Record<string, any> = {};
    for (const key of Object.keys(props)) {
      if (props[key].type === 'string') sample[key] = 'sample_value';
      else if (props[key].type === 'number') sample[key] = 1;
      else if (props[key].type === 'boolean') sample[key] = true;
      else sample[key] = null;
    }
    setParamInput(JSON.stringify(sample, null, 2));
  };

  const handleToolSelect = (tool: ToolDefinition) => {
    setSelectedTool(tool);
    setDefaultParams(tool);
    setExecResult(null);
  };

  const handleExecute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTool || executing) return;

    let parsedArgs: Record<string, any> = {};
    try {
      parsedArgs = JSON.parse(paramInput);
    } catch (parseErr) {
      onError({
        code: 'VALIDATION_ERROR',
        message: 'Invalid tool arguments JSON format.',
        details: String(parseErr),
        severity: 'warning',
        timestamp: new Date().toISOString(),
        suggestedAction: 'Ensure arguments conform to valid JSON format before executing.',
      });
      return;
    }

    setExecuting(true);
    setExecResult(null);
    try {
      const res = await api.executeTool(selectedTool.name, parsedArgs);
      setExecResult(res);
    } catch (err) {
      onError(normalizeError(err, 'AGENT_EXECUTION_FAILED'));
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div
      className="workbench-bay-card"
      ref={cardRef}
      onMouseMove={(e) => apply3DTilt(cardRef.current, e, 4, 6)}
      onMouseLeave={() => reset3DTilt(cardRef.current)}
    >
      <div className="bay-header">
        <div className="bay-title-group">
          <Wrench className="bay-icon" size={20} />
          <div>
            <h3>Controlled Local Tool Bay</h3>
            <p>Air-gapped execution sandbox with schema verification and strict permission boundaries.</p>
          </div>
        </div>

        <div className="bay-stats-cluster">
          <div className="stat-pill">
            <Shield size={14} className="shield-online-icon" />
            <span>EGRESS SHIELD</span>
            <strong>ENFORCED</strong>
          </div>
          <div className="stat-pill">
            <span>REGISTERED</span>
            <strong>{tools.length} TOOLS</strong>
          </div>
        </div>
      </div>

      <div className="bay-content-grid">
        {/* Available Tools Catalog */}
        <div className="bay-subcard">
          <h4>Registered Local Tools</h4>
          <div className="tools-catalog-list">
            {tools.map((tool) => (
              <button
                key={tool.name}
                type="button"
                className={`tool-item-card ${selectedTool?.name === tool.name ? 'active' : ''}`}
                onClick={() => handleToolSelect(tool)}
              >
                <div className="tool-item-title-row">
                  <span className="tool-name-tag">{tool.name}</span>
                  <span className="airgap-policy-pill">AIR-GAPPED</span>
                </div>
                <p className="tool-desc-text">{tool.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Selected Tool Inspector & Execution Sandbox */}
        <div className="bay-subcard">
          {selectedTool ? (
            <>
              <h4>Execute: {selectedTool.name}</h4>
              <p className="tool-param-hint">
                Schema: {Object.keys(selectedTool.parameters?.properties || {}).join(', ') || 'No parameters required'}
              </p>

              <form onSubmit={handleExecute} className="tool-exec-form">
                <label className="param-label">
                  <span>ARGUMENTS (JSON)</span>
                  <textarea
                    value={paramInput}
                    onChange={(e) => setParamInput(e.target.value)}
                    rows={4}
                    className="param-textarea"
                    aria-label="Tool arguments in JSON"
                  />
                </label>

                <button
                  type="submit"
                  className="execute-tool-btn"
                  disabled={executing}
                >
                  <Play size={15} />
                  {executing ? 'Executing Sandbox...' : 'Run Local Tool'}
                </button>
              </form>

              {execResult && (
                <div className={`tool-result-box ${execResult.success ? 'success' : 'failure'}`}>
                  <div className="result-header-row">
                    <div className="result-status-indicator">
                      {execResult.success ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                      <span>{execResult.success ? 'EXECUTION SUCCESS' : 'EXECUTION FAILED'}</span>
                    </div>
                    {execResult.execution_time_ms && (
                      <span className="exec-time-tag">
                        {execResult.execution_time_ms.toFixed(1)} ms
                      </span>
                    )}
                  </div>
                  <pre className="tool-output-pre">
                    {typeof execResult.output === 'object'
                      ? JSON.stringify(execResult.output, null, 2)
                      : String(execResult.output || execResult.error)}
                  </pre>
                </div>
              )}
            </>
          ) : (
            <p className="empty-subtext">Select a tool from the catalog to inspect schema and execute.</p>
          )}
        </div>
      </div>
    </div>
  );
}
