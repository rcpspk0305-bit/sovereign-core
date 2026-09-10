'use client';

import { ChatMessage } from './types';

export type WorkbenchBay =
  | 'mission'
  | 'overview'
  | 'chat'
  | 'knowledge'
  | 'documents'
  | 'memory'
  | 'agents'
  | 'workflows'
  | 'tools'
  | 'recorder'
  | 'models'
  | 'settings';

const ACTIVE_BAY_KEY = 'sovereign_active_bay';
const ACTIVE_SESSION_ID_KEY = 'sovereign_active_session_id';
const SESSION_MESSAGES_PREFIX = 'sovereign_session_messages_';
const SELECTED_MODEL_KEY = 'sovereign_selected_model';
const LAST_COMPLETED_TASK_KEY = 'sovereign_last_completed_task';

const SESSION_CHANGE_EVENT = 'sovereign_session_changed';
const BAY_CHANGE_EVENT = 'sovereign_bay_changed';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export const sessionStore = {
  // Active Workbench Bay
  getActiveBay(defaultBay: WorkbenchBay = 'mission'): WorkbenchBay {
    if (!isBrowser()) return defaultBay;
    try {
      const stored = localStorage.getItem(ACTIVE_BAY_KEY);
      if (stored) return stored as WorkbenchBay;
    } catch {
      // Ignore storage errors
    }
    return defaultBay;
  },

  setActiveBay(bay: WorkbenchBay): void {
    if (!isBrowser()) return;
    try {
      localStorage.setItem(ACTIVE_BAY_KEY, bay);
      window.dispatchEvent(new CustomEvent(BAY_CHANGE_EVENT, { detail: bay }));
    } catch {
      // Ignore storage errors
    }
  },

  // Active Session ID
  getActiveSessionId(defaultId: string = 'SES-20260909-001'): string {
    if (!isBrowser()) return defaultId;
    try {
      const stored = localStorage.getItem(ACTIVE_SESSION_ID_KEY);
      if (stored) return stored;
    } catch {
      // Ignore storage errors
    }
    return defaultId;
  },

  setActiveSessionId(sessionId: string): void {
    if (!isBrowser()) return;
    try {
      localStorage.setItem(ACTIVE_SESSION_ID_KEY, sessionId);
      window.dispatchEvent(new CustomEvent(SESSION_CHANGE_EVENT, { detail: sessionId }));
    } catch {
      // Ignore storage errors
    }
  },

  // Session Message Cache
  getSessionMessages(sessionId: string): ChatMessage[] | null {
    if (!isBrowser() || !sessionId) return null;
    try {
      const raw = localStorage.getItem(`${SESSION_MESSAGES_PREFIX}${sessionId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Ignore storage errors
    }
    return null;
  },

  saveSessionMessages(sessionId: string, messages: ChatMessage[]): void {
    if (!isBrowser() || !sessionId) return;
    try {
      localStorage.setItem(
        `${SESSION_MESSAGES_PREFIX}${sessionId}`,
        JSON.stringify(messages)
      );
    } catch {
      // Ignore quota exceeded or storage errors
    }
  },

  // Model Selection
  getSelectedModel(defaultModel: string = 'gemma4:e2b'): string {
    if (!isBrowser()) return defaultModel;
    try {
      const stored = localStorage.getItem(SELECTED_MODEL_KEY);
      if (stored) return stored;
    } catch {
      // Ignore storage errors
    }
    return defaultModel;
  },

  setSelectedModel(model: string): void {
    if (!isBrowser()) return;
    try {
      localStorage.setItem(SELECTED_MODEL_KEY, model);
    } catch {
      // Ignore storage errors
    }
  },

  // Last Completed Task ID for Flight Recorder
  getLastCompletedTask(): string | null {
    if (!isBrowser()) return null;
    try {
      return localStorage.getItem(LAST_COMPLETED_TASK_KEY);
    } catch {
      return null;
    }
  },

  setLastCompletedTask(taskId: string | null): void {
    if (!isBrowser()) return;
    try {
      if (taskId) {
        localStorage.setItem(LAST_COMPLETED_TASK_KEY, taskId);
      } else {
        localStorage.removeItem(LAST_COMPLETED_TASK_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  },

  // Event Listeners for Reactive Sync
  onSessionChange(handler: (sessionId: string) => void): () => void {
    if (!isBrowser()) return () => {};
    const listener = (event: Event) => {
      const custom = event as CustomEvent<string>;
      handler(custom.detail);
    };
    window.addEventListener(SESSION_CHANGE_EVENT, listener);
    return () => window.removeEventListener(SESSION_CHANGE_EVENT, listener);
  },

  onBayChange(handler: (bay: WorkbenchBay) => void): () => void {
    if (!isBrowser()) return () => {};
    const listener = (event: Event) => {
      const custom = event as CustomEvent<WorkbenchBay>;
      handler(custom.detail);
    };
    window.addEventListener(BAY_CHANGE_EVENT, listener);
    return () => window.removeEventListener(BAY_CHANGE_EVENT, listener);
  },
};
