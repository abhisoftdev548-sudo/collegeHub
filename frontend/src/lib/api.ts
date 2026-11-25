import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';

/**
 * Central API client.
 *
 * - Talks to the same origin under `/api` (in development Next.js rewrites
 *   that to the Express server, in production Express serves both).
 * - Sends the double-submit CSRF header on state-changing requests.
 * - Transparently refreshes the session once on a 401 and retries.
 * - Normalises backend errors into ApiError so UI code can react precisely.
 */
export interface ApiErrorShape {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, error: ApiErrorShape) {
    super(error.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = error.code;
    this.details = error.details;
  }

  /** Field-level messages keyed by path, useful for form errors. */
  get fieldErrors(): Record<string, string> {
    if (!Array.isArray(this.details)) return {};
    return Object.fromEntries(
      (this.details as Array<{ path?: string; message?: string }>)
        .filter((detail) => detail.path && detail.message)
        .map((detail) => [detail.path as string, detail.message as string]),
    );
  }
}

const CSRF_COOKIE = 'ch_csrf';
const CSRF_HEADER = 'x-csrf-token';

const readCookie = (name: string): string | undefined => {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
};

export const http = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 30_000,
  headers: { Accept: 'application/json' },
});

// Ensure a CSRF token exists before the first state-changing request.
let csrfPrimed: Promise<void> | null = null;
export const primeCsrf = async (): Promise<void> => {
  if (typeof document === 'undefined') return;
  if (readCookie(CSRF_COOKIE)) return;
  if (!csrfPrimed) {
    csrfPrimed = http
      .get('/auth/csrf')
      .then(() => {
        if (!readCookie(CSRF_COOKIE)) {
          throw new Error('Unable to initialize security token. Check your connection and try again.');
        }
      })
      .finally(() => {
        csrfPrimed = null;
      });
  }
  await csrfPrimed;
};

http.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const method = (config.method ?? 'get').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    await primeCsrf();
    const token = readCookie(CSRF_COOKIE);
    if (token) config.headers.set(CSRF_HEADER, token);
  }
  return config;
});

let refreshing: Promise<boolean> | null = null;

export const refreshSession = async (): Promise<boolean> => {
  if (!refreshing) {
    refreshing = http
      .post('/auth/refresh', {}, { __skipRefresh: true } as AxiosRequestConfig)
      .then(() => true)
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
};

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ success?: boolean; error?: ApiErrorShape }>) => {
    const config = error.config as (InternalAxiosRequestConfig & { __retried?: boolean; __skipRefresh?: boolean }) | undefined;
    const status = error.response?.status ?? 0;

    if (
      status === 401 &&
      config &&
      !config.__retried &&
      !config.__skipRefresh &&
      !config.url?.startsWith('/auth/login') &&
      !config.url?.startsWith('/auth/refresh')
    ) {
      config.__retried = true;
      const refreshed = await refreshSession();
      if (refreshed) return http.request(config);
    }

    const payload = error.response?.data?.error;
    throw new ApiError(
      status,
      payload ?? {
        code: 'NETWORK_ERROR',
        message:
          status === 0
            ? 'Cannot reach the server. Check your connection and try again.'
            : 'Something went wrong. Please try again.',
      },
    );
  },
);

/** Unwraps the standard `{ success, data }` envelope. */
export const api = {
  get: async <T>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    const response = await http.get<{ data: T }>(url, config);
    return response.data.data;
  },
  getPaginated: async <T>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<{ data: T[]; pagination: PaginationMeta }> => {
    const response = await http.get<{ data: T[]; pagination: PaginationMeta }>(url, config);
    return { data: response.data.data, pagination: response.data.pagination };
  },
  post: async <T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> => {
    const response = await http.post<{ data: T; message?: string }>(url, body, config);
    return response.data.data;
  },
  postWithMessage: async <T>(url: string, body?: unknown): Promise<{ data: T; message?: string }> => {
    const response = await http.post<{ data: T; message?: string }>(url, body);
    return { data: response.data.data, message: response.data.message };
  },
  patch: async <T>(url: string, body?: unknown): Promise<T> => {
    const response = await http.patch<{ data: T }>(url, body);
    return response.data.data;
  },
  put: async <T>(url: string, body?: unknown): Promise<T> => {
    const response = await http.put<{ data: T }>(url, body);
    return response.data.data;
  },
  delete: async <T>(url: string): Promise<T> => {
    const response = await http.delete<{ data: T }>(url);
    return response.data.data;
  },
};

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/** Downloads a CSV endpoint using the authenticated session. */
export const downloadFile = async (url: string, filename: string): Promise<void> => {
  const response = await http.get(url, { responseType: 'blob' });
  const blobUrl = URL.createObjectURL(response.data as Blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
};

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
};
