import { ApprovalStatus } from '@/lib/types';
import React from 'react';

export type FlightRecorderTab =
  | 'steps'
  | 'tools'
  | 'sources'
  | 'artifacts'
  | 'errors'
  | 'raw_stream';

export interface TabItem {
  id: FlightRecorderTab;
  label: string;
  count?: number;
}

export function getApprovalBadgeStyle(status: ApprovalStatus): React.CSSProperties {
  switch (status) {
    case 'APPROVED':
      return {
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        color: 'var(--accent-emerald)',
        border: '1px solid rgba(16, 185, 129, 0.4)',
        boxShadow: '0 0 12px rgba(16, 185, 129, 0.25)',
      };
    case 'AUTO_VERIFIED':
      return {
        backgroundColor: 'rgba(0, 240, 255, 0.15)',
        color: 'var(--accent-cyan)',
        border: '1px solid rgba(0, 240, 255, 0.4)',
        boxShadow: '0 0 12px rgba(0, 240, 255, 0.25)',
      };
    case 'POLICY_VIOLATION':
      return {
        backgroundColor: 'rgba(244, 63, 94, 0.2)',
        color: 'var(--accent-rose)',
        border: '1px solid rgba(244, 63, 94, 0.5)',
        boxShadow: '0 0 12px rgba(244, 63, 94, 0.3)',
      };
    case 'FAILED':
      return {
        backgroundColor: 'rgba(244, 63, 94, 0.15)',
        color: '#fb7185',
        border: '1px solid rgba(244, 63, 94, 0.35)',
      };
    case 'REJECTED':
      return {
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        color: 'var(--accent-amber)',
        border: '1px solid rgba(245, 158, 11, 0.4)',
        boxShadow: '0 0 12px rgba(245, 158, 11, 0.25)',
      };
    case 'PENDING':
    default:
      return {
        backgroundColor: 'rgba(30, 41, 59, 0.6)',
        color: 'var(--text-secondary)',
        border: '1px solid rgba(148, 163, 184, 0.3)',
      };
  }
}
