'use client';

import React, { useState } from 'react';
import Header from '@/components/layout/Header';
import Sidebar, { TabId } from '@/components/layout/Sidebar';
import ChatView from '@/components/workbench/ChatView';
import RagView from '@/components/workbench/RagView';
import ToolsView from '@/components/workbench/ToolsView';
import AgentView from '@/components/workbench/AgentView';
import FlightRecorderView from '@/components/workbench/FlightRecorderView';
import AuditViewer from '@/components/workbench/AuditViewer';

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>('chat');
  const [selectedModel, setSelectedModel] = useState<string>('gemma4:e2b');

  return (
    <div className="app-container">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="main-content">
        <Header
          selectedModel={selectedModel}
          onSelectModel={setSelectedModel}
        />
        <div className="content-body">
          <div
            id="tab-panel-chat"
            role="tabpanel"
            aria-labelledby="tab-chat"
            style={{
              display: activeTab === 'chat' ? 'flex' : 'none',
              flexDirection: 'column',
              flex: 1,
              minHeight: 0,
            }}
          >
            <ChatView model={selectedModel} isActive={activeTab === 'chat'} />
          </div>

          <div
            id="tab-panel-rag"
            role="tabpanel"
            aria-labelledby="tab-rag"
            style={{
              display: activeTab === 'rag' ? 'block' : 'none',
              minHeight: '100%',
            }}
          >
            <RagView isActive={activeTab === 'rag'} />
          </div>

          <div
            id="tab-panel-tools"
            role="tabpanel"
            aria-labelledby="tab-tools"
            style={{
              display: activeTab === 'tools' ? 'block' : 'none',
              minHeight: '100%',
            }}
          >
            <ToolsView />
          </div>

          <div
            id="tab-panel-agents"
            role="tabpanel"
            aria-labelledby="tab-agents"
            style={{
              display: activeTab === 'agents' ? 'block' : 'none',
              minHeight: '100%',
            }}
          >
            <AgentView model={selectedModel} />
          </div>

          <div
            id="tab-panel-flight-recorder"
            role="tabpanel"
            aria-labelledby="tab-flight-recorder"
            style={{
              display: activeTab === 'flight-recorder' ? 'block' : 'none',
              minHeight: '100%',
            }}
          >
            <FlightRecorderView model={selectedModel} />
          </div>

          <div
            id="tab-panel-audit"
            role="tabpanel"
            aria-labelledby="tab-audit"
            style={{
              display: activeTab === 'audit' ? 'block' : 'none',
              minHeight: '100%',
            }}
          >
            <AuditViewer isActive={activeTab === 'audit'} />
          </div>
        </div>
      </main>
    </div>
  );
}
