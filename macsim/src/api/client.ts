import type { ApiError } from './types';

const DEFAULT_BASE_URL = 'http://127.0.0.1:8001/api/v1';

export function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  return DEFAULT_BASE_URL;
}

export class NetworkError extends Error {
  readonly originalError?: unknown;

  constructor(message: string, originalError?: unknown) {
    super(message);
    this.name = 'NetworkError';
    this.originalError = originalError;
  }
}

export class HttpResponseError extends Error {
  readonly statusCode: number;
  readonly apiError: ApiError;

  constructor(statusCode: number, apiError: ApiError) {
    super(apiError.message || `Request failed with status ${statusCode}`);
    this.name = 'HttpResponseError';
    this.statusCode = statusCode;
    this.apiError = apiError;
  }
}

interface RequestOptions extends RequestInit {
  timeoutMs?: number;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${baseUrl}${normalizedPath}`;

  const { timeoutMs = 30000, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const signal = options.signal
    ? AbortSignal.any([controller.signal, options.signal])
    : controller.signal;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (fetchOptions.body && typeof fetchOptions.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 204) {
      return {} as T;
    }

    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');

    if (!response.ok) {
      let errorPayload: ApiError = {
        statusCode: response.status,
        message: `HTTP error ${response.status}: ${response.statusText}`,
      };

      if (isJson) {
        try {
          const body = await response.json();
          errorPayload = {
            statusCode: body.statusCode ?? response.status,
            error: body.error?.code ?? body.error ?? response.statusText,
            message:
              body.message ??
              body.error?.message ??
              `Request failed with status ${response.status}`,
            details: body.details ?? body.error?.details,
          };
        } catch {
          // Fall back to default error payload
        }
      } else {
        const text = await response.text();
        if (text) {
          errorPayload.message = text;
        }
      }

      throw new HttpResponseError(response.status, errorPayload);
    }

    if (isJson) {
      return (await response.json()) as T;
    }

    return (await response.text()) as unknown as T;
  } catch (err: unknown) {
    clearTimeout(timeoutId);

    if (err instanceof HttpResponseError) {
      throw err;
    }

    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new NetworkError('Request timed out or was cancelled');
    }

    const message =
      err instanceof Error
        ? `Backend connection error: ${err.message}. Is the MACSim server running at ${baseUrl}?`
        : `Cannot connect to backend server at ${baseUrl}`;

    throw new NetworkError(message, err);
  }
}
