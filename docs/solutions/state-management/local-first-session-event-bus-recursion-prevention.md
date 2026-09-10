---
title: Local-First Session State Synchronization and Event-Bus Recursion Prevention
date: 2026-09-10
category: state-management
module: frontend/src/components/chat
problem_type: ui_bug
component: frontend
symptoms:
  - "Browser tab freezes or crashes with maximum call stack exceeded when switching chat sessions"
  - "Switching workbench tabs destroys active input state, form data, and WebSocket telemetry connections"
  - "SSR hydration mismatch errors on page load due to client-server locale discrepancies"
root_cause: logic_error
resolution_type: code_fix
severity: high
tags: [react, event-bus, session-management, air-gapped, hydration, local-first]
---

# Local-First Session State Synchronization and Event-Bus Recursion Prevention

## Problem
In Sovereign-Core's air-gapped Next.js workbench, switching active chat sessions caused the browser tab to lock up or crash with `RangeError: Maximum call stack size exceeded`. Furthermore, navigating across top-level workbench tabs unmounted active workspaces, terminating active WebSocket telemetry streams and dropping unsubmitted user prompts and forensic investigation state.

## Symptoms
- Browser tab unresponsive after clicking a session in the session history tray or activating a session via hotkey.
- Console trace pointing to an unbounded ping-pong between `onSessionChange` event listeners and `sessionStore.setActiveSessionId`.
- Active WebSocket connection to `/api/v1/flight-recorder/ws` dropping every time an operator switched between the Mission and Knowledge or Flight Log tabs.
- Next.js throwing React hydration mismatch warnings (`Hydration failed because the server rendered text didn't match the client`) for formatted session dates and timestamps.

## What Didn't Work
- Relying on a single `handleSelectSession` callback to handle both user-initiated UI clicks and reactive external `sessionStore` change notifications.
- Using simple React component-level `activeSessionId` state in the event listener, which suffered from stale closures comparing against the initial mount-time default (`SES-20260909-001`).
- Conditionally mounting/unmounting tab views with `{currentBay === 'workflows' && <WorkflowNodeCanvas />}` in the parent container, which tore down Three.js canvas contexts and active streaming sockets.

## Solution

### 1. Separation of Concerns in Session State Transitions
Decoupled internal local state synchronization from store writes. The event listener invokes `switchSessionLocalState`, which never writes back to the store, breaking the feedback loop:

```typescript
// Subscriber-safe local transition (no store writeback)
const switchSessionLocalState = (sessionId: string) => {
  activeSessionIdRef.current = sessionId;
  setActiveSessionId(sessionId);
  // Load session turns into local workspace state
  const session = sessionStore.getSession(sessionId);
  if (session) {
    setMessages(session.turns || []);
  }
};

// User-initiated action (updates ref and writes to persistent store)
const handleSelectSession = (sessionId: string) => {
  if (sessionId === activeSessionIdRef.current) return;
  activeSessionIdRef.current = sessionId;
  setActiveSessionId(sessionId);
  sessionStore.setActiveSessionId(sessionId); // Fires event to other listeners safely
};
```

### 2. Dual Mutual Suppression via Mutable Ref
Protected subscriber callbacks with an `activeSessionIdRef` guard to eliminate stale closure comparison pitfalls:

```typescript
useEffect(() => {
  const unsubscribe = sessionStore.onSessionChange((newSessionId) => {
    // Stale closure immune guard:
    if (newSessionId === activeSessionIdRef.current) return;
    switchSessionLocalState(newSessionId);
  });
  return unsubscribe;
}, []);
```

### 3. Persistent DOM State via CSS Display Toggles
Preserved all workspace components in the DOM tree, replacing unmounting with CSS display toggling to maintain WebSockets, WebGL/Three.js contexts, and form state:

```tsx
<div style={{ display: currentBay === 'workflows' ? 'block' : 'none' }}>
  <WorkflowNodeCanvas />
</div>
<div style={{ display: currentBay === 'recorder' ? 'block' : 'none' }}>
  <FlightRecorderBay />
</div>
```

### 4. Locale-Pinned Formatting for SSR Hydration Stability
Pinned all temporal and numerical formatting to `'en-US'` across server and client to prevent server locale drift:

```typescript
const formattedTokens = tokenCount.toLocaleString('en-US');
```

## Why This Works
The infinite recursion occurred because the reactive subscriber called the same mutating handler that emitted the event. Separating the read/local synchronization path (`switchSessionLocalState`) from the mutation path (`handleSelectSession`) breaks the cycle mathematically. The `useRef` ensures that rapid event dispatches always compare against real-time memory rather than frozen React render closures. Display toggling ensures the browser retains DOM nodes, active WebSockets, and state without triggering unmount lifecycles.

## Prevention
- Never call a global store write or event dispatch from inside the listener that subscribes to changes from that exact store.
- Always maintain an `activeIdRef` parallel to React state when listening to window/localStorage event buses to prevent stale closure bugs.
- For air-gapped workbench environments with live WebSockets or 3D viewports, avoid conditional unmounting for primary navigation; use CSS visibility toggling or offscreen rendering.
- Always provide an explicit locale string (`'en-US'`) to `.toLocaleString()` and date formatters in SSR frameworks.

## Related Issues
- [Architecture Documentation](../../ARCHITECTURE.md)
- [API Reference](../../API_REFERENCE.md)
- [Flight Recorder Spec](../../FLIGHT_RECORDER_SPEC.md)
