'use client';

import React, { useState, useRef, useEffect } from 'react';
import { api } from '@/lib/api-client';
import { ChatMessage } from '@/lib/types';
import { Send, Bot, User, Zap, Clock, Trash2 } from 'lucide-react';

interface ChatViewProps {
  model: string;
  isActive?: boolean;
}

const DEFAULT_WELCOME_MESSAGE: ChatMessage = {
  role: 'assistant',
  content: 'Welcome to Sovereign-Core. I am running entirely on your local machine via Ollama. How can I assist you today?',
};

export default function ChatView({ model, isActive }: ChatViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([DEFAULT_WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamMode, setStreamMode] = useState(true);
  const [lastMetrics, setLastMetrics] = useState<{ latency_ms?: number; tokens?: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Hydration-safe restore from sessionStorage
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('sovereign_chat_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      }
    } catch {
      // sessionStorage unavailable or parse error
    }
  }, []);

  // Save to sessionStorage whenever messages change
  useEffect(() => {
    try {
      if (messages.length > 1) {
        sessionStorage.setItem('sovereign_chat_history', JSON.stringify(messages));
      } else if (messages.length === 1 && messages[0].role === 'assistant') {
        sessionStorage.removeItem('sovereign_chat_history');
      }
    } catch {
      // ignore
    }
  }, [messages]);

  const handleClear = () => {
    setMessages([DEFAULT_WELCOME_MESSAGE]);
    setLastMetrics(null);
    try {
      sessionStorage.removeItem('sovereign_chat_history');
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Scroll to bottom when tab becomes active
  useEffect(() => {
    if (isActive) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [isActive]);

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
              aria-label="Toggle streaming response"
            />
            Stream Response
          </label>
          <button
            className="btn btn-secondary"
            onClick={handleClear}
            title="Reset conversation"
            aria-label="Reset conversation"
            style={{ padding: '6px 10px', fontSize: '12px' }}
          >
            <Trash2 size={13} />
            <span>Reset</span>
          </button>
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
          const isError = !isUser && m.content.startsWith('[Error:');
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
                    width: '34px',
                    height: '34px',
                    borderRadius: '50%',
                    background: isError ? 'rgba(244, 63, 94, 0.15)' : 'rgba(15, 23, 42, 0.8)',
                    border: isError ? '1px solid var(--accent-rose)' : '1px solid rgba(0, 240, 255, 0.3)',
                    boxShadow: isError ? '0 0 10px var(--accent-rose-glow)' : '0 0 10px var(--accent-cyan-glow)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Bot size={18} color={isError ? 'var(--accent-rose)' : 'var(--accent-cyan)'} />
                </div>
              )}

              <div
                style={{
                  background: isUser
                    ? 'linear-gradient(135deg, var(--accent-indigo), #4338ca)'
                    : isError
                    ? 'rgba(244, 63, 94, 0.1)'
                    : 'rgba(15, 23, 42, 0.75)',
                  color: isError ? '#fda4af' : '#ffffff',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  border: isUser
                    ? '1px solid rgba(99, 102, 241, 0.4)'
                    : isError
                    ? '1px solid rgba(244, 63, 94, 0.4)'
                    : '1px solid var(--border-subtle)',
                  boxShadow: isUser
                    ? '0 4px 16px var(--accent-indigo-glow)'
                    : isError
                    ? '0 4px 16px var(--accent-rose-glow)'
                    : '0 4px 20px rgba(0, 0, 0, 0.4)',
                  backdropFilter: 'blur(10px)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {m.content}
              </div>

              {isUser && (
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--accent-indigo), #4f46e5)',
                    boxShadow: '0 0 10px var(--accent-indigo-glow)',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-cyan)', fontSize: '12px', paddingLeft: '46px' }}>
            <Bot size={15} className="pulse-beacon" />
            <span>Computing neural tokens...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={{ display: 'flex', gap: '10px', paddingTop: '8px' }}>
        <input
          type="text"
          id="chat-prompt-input"
          aria-label="Transmit prompt or query to local intelligence node"
          className="input"
          placeholder="Transmit prompt or query to local intelligence node..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          disabled={loading}
          style={{
            backgroundColor: 'rgba(3, 7, 18, 0.85)',
            backdropFilter: 'blur(12px)',
          }}
        />
        <button
          className="btn btn-primary"
          onClick={handleSend}
          aria-label="Transmit message"
          disabled={loading || !input.trim()}
          style={{ minWidth: '95px' }}
        >
          <Send size={15} />
          <span>Transmit</span>
        </button>
      </div>
    </div>
  );
}
