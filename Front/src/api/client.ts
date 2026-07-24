// ─────────────────────────────────────────────────────────────────────────────
// Client HTTP de base : gestion du token JWT (localStorage), refresh auto, erreurs.
// ─────────────────────────────────────────────────────────────────────────────
import i18n from '../i18n/config';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

const ACCESS_KEY = 'cn_access_token';
const REFRESH_KEY = 'cn_refresh_token';

export const tokenStore = {
  getAccess: () => localStorage.getItem(ACCESS_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  set: (access: string, refresh?: string) => {
    localStorage.setItem(ACCESS_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export class ApiError extends Error {
  status: number;
  body?: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

async function rawRequest(
  path: string,
  options: RequestInit,
  withAuth: boolean,
): Promise<Response> {
  const headers = new Headers(options.headers);
  const isForm = options.body instanceof FormData;
  if (!isForm && options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  // Les messages d'erreur de l'API suivent Accept-Language (fr par défaut, en supporté).
  headers.set('Accept-Language', i18n.language ?? 'fr');
  if (withAuth) {
    const token = tokenStore.getAccess();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(`${BASE}${path}`, { ...options, headers });
}

async function tryRefresh(): Promise<boolean> {
  const refresh = tokenStore.getRefresh();
  if (!refresh) return false;
  try {
    const res = await rawRequest(
      '/auth/refresh',
      { method: 'POST', body: JSON.stringify({ refresh_token: refresh }) },
      false,
    );
    if (!res.ok) return false;
    const data = await res.json();
    if (data?.access_token) {
      tokenStore.set(data.access_token);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

export async function request<T>(
  path: string,
  options: RequestInit = {},
  withAuth = true,
): Promise<T> {
  let res = await rawRequest(path, options, withAuth);

  // Token expiré → on tente un refresh une fois, puis on rejoue la requête
  if (res.status === 401 && withAuth && tokenStore.getRefresh()) {
    const ok = await tryRefresh();
    if (ok) res = await rawRequest(path, options, withAuth);
  }

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const message =
      (data && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : typeof data === 'string' && data
          ? data
          : res.statusText) || 'Erreur réseau';
    throw new ApiError(res.status, message, data);
  }

  return data as T;
}

export const http = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  del: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'DELETE',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  upload: <T>(path: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<T>(path, { method: 'POST', body: fd });
  },
};

// télécharge un fichier (zip, pdf) avec le token
export async function downloadBlob(path: string): Promise<Blob> {
  const avecToken = () => {
    const h = new Headers();
    const token = tokenStore.getAccess();
    if (token) h.set('Authorization', `Bearer ${token}`);
    return h;
  };
  let res = await fetch(`${BASE}${path}`, { headers: avecToken() });
  if (res.status === 401 && tokenStore.getRefresh()) {
    if (await tryRefresh()) res = await fetch(`${BASE}${path}`, { headers: avecToken() });
  }
  if (!res.ok) throw new ApiError(res.status, 'Téléchargement impossible');
  return res.blob();
}
