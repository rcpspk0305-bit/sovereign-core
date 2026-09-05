'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { ModelInfo } from '@/lib/types';
import { Box, RefreshCw } from 'lucide-react';

interface ModelSelectorProps {
  selectedModel: string;
  onSelectModel: (model: string) => void;
}

export default function ModelSelector({
  selectedModel,
  onSelectModel,
}: ModelSelectorProps) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const loadModels = async () => {
    setLoading(true);
    try {
      const list = await api.listModels();
      setModels(list);
      if (list.length > 0 && !selectedModel) {
        onSelectModel(list[0].id);
      }
    } catch (e) {
      console.warn('Failed to load Ollama models:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadModels();
  }, []);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <Box size={16} color="var(--accent-cyan)" />
      <select
        className="select"
        value={selectedModel}
        onChange={(e) => onSelectModel(e.target.value)}
        style={{ minWidth: '200px', fontSize: '13px' }}
      >
        {models.length === 0 ? (
          <option value="">No local models detected</option>
        ) : (
          models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} {m.size_bytes ? `(${(m.size_bytes / (1024 * 1024 * 1024)).toFixed(1)} GB)` : ''}
            </option>
          ))
        )}
      </select>
      <button
        className="btn btn-secondary"
        onClick={loadModels}
        title="Refresh models"
        style={{ padding: '8px 10px' }}
      >
        <RefreshCw size={14} className={loading ? 'spin' : ''} />
      </button>
    </div>
  );
}
