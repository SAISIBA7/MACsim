import { apiRequest } from './client';
import type { HealthResponse, ProtocolsResponse } from './types';

export async function getHealth(): Promise<HealthResponse> {
  return apiRequest<HealthResponse>('/health');
}

export async function getProtocols(): Promise<ProtocolsResponse> {
  return apiRequest<ProtocolsResponse>('/protocols');
}

