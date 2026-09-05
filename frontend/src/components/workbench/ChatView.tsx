'use client';

import React, { useState, useRef, useEffect } from 'react';
import { api } from '@/lib/api-client';
import { ChatMessage } from '@/lib/types';
import { Send, Bot, User, Zap, Clock } from 'lucide-react';

interface ChatViewProps {
  model: string;
}

export default function ChatView({ model }: ChatViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Welcome to Sovereign-Core. I am running entirely on your local machine via Ollama. How can I assist you today?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamMode, setStreamMode] = useState(true);
  const [lastMetrics, setLastMetrics] = useState<{ latency_ms?: number; tokens?: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: ChatMessage = { role: 'user', content: input.trim() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    const startTime = performance.now();

    if (streamMode) {
      let streamedResponse = '';
      const assistantMessage: ChatMessage = { role: 'assistant', content: '' };
      setMessages([...updatedMessages, assistantMessage]);

      await api.streamChat(
        updatedMessages,
        model || undefined,
        (chunk) => {
          streamedResponse += chunk;
          setMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = { role: 'assistant', content: streamedResponse };
            return copy;
          });
        },
        () => {
          setLoading(false);
          setLastMetrics({
            latency_ms: Math.round(performance.now() - startTime),
          });
        },
        (err) => {
          setLoading(false);
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: `[Error: ${err}]` },
          ]);
        }
      );
    } else {
      try {
        const res = await api.sendChat(updatedMessages, model || undefined);
        setMessages([...updatedMessages, { role: 'assistant', content: res.content }]);
        setLastMetrics({
          latency_ms: res.latency_ms,
          tokens: res.usage?.total_tokens,
        });
      } catch (err: any) {
        setMessages([
          ...updatedMessages,
          { role: 'assistant', content: `[Error: ${err.message}]` },
        ]);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '12px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Local LLM Playground</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Active Target: <span style={{ color: 'var(--accent-cyan)' }}>{model || 'Default'}</span>
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {lastMetrics && (
            <div style={{ display: 'flex', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
              {lastMetrics.latency_ms && (
                <span className="badge badge-success">
                  <Clock size={11} /> {lastMetrics.latency_ms} ms
                </span>
              )}
              {lastMetrics.tokens && (
                <span className="badge badge-warning">
                  <Zap size={11} /> {lastMetrics.tokens} tokens
                </span>
              )}
            </div>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={streamMode}
              onChange={(e) => setStreamMode(e.target.checked)}
            />
            Stream Response
          </label>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          paddingRight: '8px',
        }}
      >
        {messages.map((m, idx) => {
          const isUser = m.role === 'user';
          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                gap: '12px',
                alignSelf: isUser ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
              }}
            >
              {!isUser && (
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Bot size={18} color="var(--accent-cyan)" />
                </div>
              )}

              <div
                style={{
                  background: isUser ? 'var(--accent-indigo)' : 'var(--bg-card)',
                  color: '#ffffff',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  border: isUser ? 'none' : '1px solid var(--border-subtle)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {m.content}
              </div>

              {isUser && (
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'var(--accent-indigo)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <User size={18} color="#ffffff" />
                </div>
              )}
            </div>
          );
        })}
        {loading && !streamMode && (
          <div style={{ display: 'flex', gap: '8px', color: 'var(--text-muted)', fontSize: '13px' }}>
            <Bot size={16} />
            <span>Thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={{ display: 'flex', gap: '8px', paddingTop: '8px' }}>
        <input
          type="text"
          className="input"
          placeholder="Type a message or prompt..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          disabled={loading}
        />
        <button
          className="btn btn-primary"
          onClick={handleSend}
          disabled={loading || !input.trim()}
        >
          <Send size={16} />
          <span>Send</span>
        </button>
      </div>
    </div>
  );
}
