import { ApprovalStatus, NetworkMode } from '@/lib/types';

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

export function getApprovalBadgeClass(status: ApprovalStatus): { bg: string; text: string; border: string } {
  switch (status) {
    case 'APPROVED':
      return { bg: 'bg-emerald-950/40', text: 'text-emerald-400', border: 'border-emerald-800/60' };
    case 'AUTO_VERIFIED':
      return { bg: 'bg-blue-950/40', text: 'text-blue-400', border: 'border-blue-800/60' };
    case 'POLICY_VIOLATION':
      return { bg: 'bg-red-950/50', text: 'text-red-400', border: 'border-red-800/80' };
    case 'FAILED':
      return { bg: 'bg-rose-950/40', text: 'text-rose-400', border: 'border-rose-800/60' };
    case 'REJECTED':
      return { bg: 'bg-amber-950/40', text: 'text-amber-400', border: 'border-amber-800/60' };
    case 'PENDING':
    default:
      return { bg: 'bg-zinc-900', text: 'text-zinc-400', border: 'border-zinc-700' };
  }
}
