/**
 * Cliente HTTP del frontend. Solo habla con nuestra propia API (/api/*).
 * NUNCA contacta a Gemini directamente: la clave vive solo en el servidor.
 */

const TOKEN_KEY = 'prexi_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(public status: number, message: string, public detalle?: unknown) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let msg = `Error ${res.status}`;
    let detalle: unknown;
    try {
      const data = await res.json();
      msg = data.error ?? msg;
      detalle = data.detalle;
    } catch {
      /* respuesta sin cuerpo JSON */
    }
    if (res.status === 401) tokenStore.clear();
    throw new ApiError(res.status, msg, detalle);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(p: string) => request<T>('GET', p),
  post: <T>(p: string, body?: unknown) => request<T>('POST', p, body),
  put: <T>(p: string, body?: unknown) => request<T>('PUT', p, body),
  del: <T>(p: string) => request<T>('DELETE', p),
};
