import type { Protocol, StationStatus } from '../types';

const protocolLabels: Record<Protocol, string> = {
  PURE_ALOHA: 'Pure ALOHA',
  SLOTTED_ALOHA: 'Slotted ALOHA',
  CSMA: 'CSMA',
  CSMA_CD: 'CSMA/CD',
};

const statusLabels: Record<StationStatus, string> = {
  IDLE: 'Idle',
  SENSING: 'Sensing',
  TRANSMITTING: 'Transmitting',
  COLLISION: 'Collision',
  BACKOFF: 'Backoff',
  WAITING: 'Waiting',
  SUCCESSFUL: 'Successful',
};

export function formatProtocol(protocol: Protocol): string {
  return protocolLabels[protocol];
}

export function formatStatus(status: StationStatus): string {
  return statusLabels[status];
}

export function formatNumber(value: number | undefined, digits = 0): string {
  if (value === undefined || !Number.isFinite(value)) return 'Not available';
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

export function formatDuration(milliseconds: number): string {
  return `${formatNumber(milliseconds, 1)} ms`;
}

export function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleString();
}
