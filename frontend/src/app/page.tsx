'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Bot, ChevronRight, CircleDot, Database, FileSearch, Orbit, Radar, ShieldCheck, Sparkles, Terminal, Wrench } from 'lucide-react';
import { api } from '@/lib/api-client';

type Section = 'mission' | 'knowledge' | 'tools' | 'recorder';

const sections: Array<{ id: Section; label: string; icon: typeof Orbit; eyebrow: string; title: string; detail: string }> = [
  { id: 'mission', label: 'Mission control', icon: Orbit, eyebrow: 'ORBITAL COMMAND', title: 'Reason locally.\nOperate deliberately.', detail: 'A private control plane for grounded analysis, controlled tools, and auditable local inference.' },
  { id: 'knowledge', label: 'Knowledge field', icon: Database, eyebrow: 'VECTOR MEMORY', title: 'Turn documents\ninto a navigable field.', detail: 'Index local PDFs, retrieve their context, and retain page-level provenance for every source.' },
  { id: 'tools', label: 'Tool bay', icon: Wrench, eyebrow: 'CONTROLLED ACTIONS', title: 'Every action\nstays inside the boundary.', detail: 'Execute only registered local tools with validation, timing, and structured audit events.' },
  { id: 'recorder', label: 'Flight recorder', icon: Radar, eyebrow: 'MISSION TELEMETRY', title: 'Nothing important\nleaves the black box.', detail: 'Trace decisions, sources, artifacts, errors, and review status in a durable mission record.' },
];

export default function Home() {
  const [active, setActive] = useState<Section>('mission');
  const [prompt, setPrompt] = useState('Inspect the available local knowledge and produce a grounded mission brief.');
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [model, setModel] = useState('gemma4:e2b');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState('Ready for a local mission. Your requests remain inside the configured workbench.');
  const current = useMemo(() => sections.find((section) => section.id === active) ?? sections[0], [active]);

  useEffect(() => {
    let mounted = true;
    api.getHealth().then((health) => {
      if (!mounted) return;
      setStatus(health.ollama_connected ? 'online' : 'offline');
      setModel(health.default_model || 'gemma4:e2b');
    }).catch(() => mounted && setStatus('offline'));
    return () => { mounted = false; };
  }, []);

  async function dispatchMission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!prompt.trim() || running) return;
    setRunning(true);
    setResult('Mission is being recorded. The controlled agent is evaluating the request...');
    try {
      const record = await api.runFlightMission(prompt.trim(), model, 'AIR_GAPPED_LOCAL', undefined, 5);
      setResult(record.final_response || `Mission ${record.task_id} completed with ${record.status} status.`);
    } catch (error) {
      setResult(`Mission link unavailable: ${error instanceof Error ? error.message : 'Unable to reach the local command service.'}`);
    } finally { setRunning(false); }
  }

  return <main className="constellation-shell">
    <div className="star-canvas" aria-hidden="true" /><div className="aurora aurora-one" aria-hidden="true" /><div className="aurora aurora-two" aria-hidden="true" />
    <header className="topbar">
      <a className="wordmark" href="#mission" aria-label="Sovereign Core home"><span className="wordmark-mark"><Sparkles size={15} /></span>SOVEREIGN<span>/</span>CORE</a>
      <div className="system-chip"><span className={`status-pulse ${status}`} />{status === 'checking' ? 'Checking local node' : status === 'online' ? 'Local node online' : 'Offline simulation'}</div>
      <div className="topbar-meta"><span>MODEL</span><strong>{model}</strong></div>
    </header>
    <div className="orbital-layout">
      <aside className="navigation-panel"><p className="panel-label">WORKBENCH</p><nav>{sections.map((section, index) => { const Icon = section.icon; return <button key={section.id} className={`nav-item ${active === section.id ? 'active' : ''}`} onClick={() => setActive(section.id)}><span className="nav-index">0{index + 1}</span><Icon size={17} /><span>{section.label}</span></button>; })}</nav><div className="nav-footnote"><ShieldCheck size={16} /><span>Air-gapped by design<br />Local-first execution</span></div></aside>
      <section className="hero-stage" id="mission">
        <div className="hero-copy"><p className="eyebrow"><CircleDot size={13} /> {current.eyebrow}</p><h1>{current.title.split('\n').map((line) => <span key={line}>{line}</span>)}</h1><p className="hero-detail">{current.detail}</p><div className="hero-actions"><button className="primary-action" onClick={() => document.getElementById('mission-console')?.scrollIntoView({ behavior: 'smooth' })}>Start a mission <ArrowUpRight size={17} /></button><button className="quiet-action" onClick={() => setActive('recorder')}>Explore telemetry <ChevronRight size={17} /></button></div></div>
        <div className="orbital-visual" aria-label="Animated local intelligence orbital graphic"><div className="orbit orbit-a" /><div className="orbit orbit-b" /><div className="orbit orbit-c" /><div className="orbital-node node-one" /><div className="orbital-node node-two" /><div className="orbital-node node-three" /><div className="core-sphere"><div className="sphere-glint" /><span>SC</span></div><div className="signal-tag"><span className="status-pulse online" /> PRIVATE INFERENCE</div></div>
      </section>
      <aside className="readout-panel"><p className="panel-label">LIVE READOUT</p><div className="metric"><span>NETWORK MODE</span><strong>NO EGRESS</strong><i /></div><div className="metric"><span>VECTOR STORE</span><strong>READY</strong><i /></div><div className="metric"><span>MISSION LOG</span><strong>ARMED</strong><i /></div><div className="coordinate-card"><span>COORDINATES</span><strong>19.0760° N<br />72.8777° E</strong><small>LOCAL EXECUTION NODE</small></div></aside>
    </div>
    <section className="capability-strip"><article><FileSearch size={21} /><div><span>RAG INDEX</span><strong>Source-grounded retrieval</strong></div></article><article><Bot size={21} /><div><span>LOCAL LLM</span><strong>Ollama-native reasoning</strong></div></article><article><Terminal size={21} /><div><span>TRACEABILITY</span><strong>Complete mission history</strong></div></article></section>
    <section className="mission-console" id="mission-console"><div className="console-heading"><div><p className="eyebrow"><Orbit size={13} /> MISSION UPLINK</p><h2>Send a controlled request</h2></div><span className="console-status">{running ? 'TRANSMITTING' : 'CHANNEL READY'}</span></div><form onSubmit={dispatchMission}><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} aria-label="Mission request" placeholder="Describe an inspection, retrieval, or analysis mission..." rows={3} /><button className="launch-button" type="submit" disabled={running || !prompt.trim()}>{running ? 'Recording mission...' : 'Launch mission'} <ArrowUpRight size={17} /></button></form><div className="result-line"><span>MISSION FEED</span><p>{result}</p></div></section>
  </main>;
}
