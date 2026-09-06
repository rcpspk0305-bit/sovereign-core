'use client';

import React, { useState } from 'react';
import Header from '@/components/layout/Header';
import Sidebar, { TabId } from '@/components/layout/Sidebar';
import ChatView from '@/components/workbench/ChatView';
import RagView from '@/components/workbench/RagView';
import ToolsView from '@/components/workbench/ToolsView';
import AgentView from '@/components/workbench/AgentView';
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
          {activeTab === 'chat' && <ChatView model={selectedModel} />}
          {activeTab === 'rag' && <RagView />}
          {activeTab === 'tools' && <ToolsView />}
          {activeTab === 'agents' && <AgentView model={selectedModel} />}
          {activeTab === 'audit' && <AuditViewer />}
        </div>
      </main>
    </div>
  );
}
