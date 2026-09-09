'use client';

import React, { useEffect, useState } from 'react';
import { api, normalizeError } from '@/lib/api-client';
import { AppError, FlightRecord } from '@/lib/types';

import CosmicCanvas3D from '@/components/landing/CosmicCanvas3D';
import SpaceNavigation from '@/components/landing/SpaceNavigation';
import CosmicHero from '@/components/landing/CosmicHero';
import WorkflowSection from '@/components/landing/WorkflowSection';
import SpaceFooter from '@/components/landing/SpaceFooter';
import AgentChatLauncher, { WorkbenchBay } from '@/components/chat/AgentChatLauncher';
import ErrorDiagnosticModal from '@/components/workbench/ErrorDiagnosticModal';


export default function Home() {
  // Universal modern navigation: 'app' (holds all 5 bays with top pill navigation bar) or 'landing' (3D showcase)
  const [viewMode, setViewMode] = useState<'app' | 'landing'>('app');
  const [activeBay, setActiveBay] = useState<WorkbenchBay>('mission');
  const [model, setModel] = useState<string>('gemma4:e2b');
  const [availableModels, setAvailableModels] = useState<string[]>([
    'gemma4:e2b',
    'gemma4:e4b-it-qat',
  ]);
  const [activeError, setActiveError] = useState<AppError | null>(null);
  const [lastCompletedTask, setLastCompletedTask] = useState<string | null>(null);

  // Check health and available models on mount
  useEffect(() => {
    let mounted = true;

    api
      .getHealth()
      .then((health) => {
        if (!mounted) return;
        if (health.default_model) {
          setModel(health.default_model);
        }
        if (health.available_models && health.available_models.length > 0) {
          setAvailableModels(health.available_models);
        }
      })
      .catch((err) => {
        if (!mounted) return;
        setActiveError(normalizeError(err, 'NETWORK_OFFLINE'));
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleMissionCompleted = (record: FlightRecord) => {
    setLastCompletedTask(record.task_id);
  };

  const handleExploreWorkflow = () => {
    setViewMode('landing');
    setTimeout(() => {
      const el = document.getElementById('ingestion');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleOpenBay = (bay: WorkbenchBay = 'mission') => {
    setActiveBay(bay);
    setViewMode('app');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToLanding = () => {
    setViewMode('landing');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main className="constellation-shell">
      {/* Background Aurora Lighting Overlays */}
      <div className="aurora aurora-one" aria-hidden="true" />
      <div className="aurora aurora-two" aria-hidden="true" />

      {viewMode === 'app' && (
        /* ============================================================ */
        /* PRIMARY UNIVERSAL INTERFACE: TOP PILL SWITCHER & FULL BAYS  */
        /* (01 Mission, 02 Knowledge, 03 Memory Flow, 04 Tools, 05 Log) */
        /* ============================================================ */
        <AgentChatLauncher
          onBackToLanding={handleBackToLanding}
          activeBay={activeBay}
          onBayChange={(bay) => setActiveBay(bay)}
          onOpenWorkbench={(bay) => handleOpenBay((bay as WorkbenchBay) || 'mission')}
          availableModels={availableModels}
          currentModel={model}
          onModelChange={(m) => setModel(m)}
          onError={(err) => setActiveError(err)}
          lastCompletedTask={lastCompletedTask}
          onMissionCompleted={handleMissionCompleted}
        />
      )}

      {viewMode === 'landing' && (
        /* ============================================================ */
        /* 3D COSMIC OVERVIEW & ARCHITECTURE SHOWCASE                   */
        /* ============================================================ */
        <div className="landing-experience-wrapper">
          <CosmicCanvas3D />

          <SpaceNavigation
            onLaunchWorkbench={(bay) => handleOpenBay((bay as WorkbenchBay) || 'knowledge')}
            onOpenLauncher={() => handleOpenBay('mission')}
            currentMode="landing"
          />

          <CosmicHero
            onExploreWorkflow={handleExploreWorkflow}
            onLaunchWorkbench={() => handleOpenBay('knowledge')}
            onOpenLauncher={() => handleOpenBay('mission')}
          />

          <WorkflowSection onLaunchWorkbench={() => handleOpenBay('knowledge')} />

          <SpaceFooter
            onBackToTop={handleBackToTop}
            onLaunchWorkbench={() => handleOpenBay('knowledge')}
          />
        </div>
      )}

      {/* 3D Holographic Error Diagnostic Modal */}
      <ErrorDiagnosticModal
        error={activeError}
        onDismiss={() => setActiveError(null)}
        onRetry={() => {
          setActiveError(null);
          api.getHealth().catch((e) => setActiveError(normalizeError(e)));
        }}
      />
    </main>
  );
}
