// Cliente HTTP. Llama a /api (mismo origen vía rewrite → API NestJS).
// La cookie httpOnly del JWT se envía/recibe automáticamente (credentials).

export class ApiError extends Error {
  constructor(public status: number, message: string, public detalle?: unknown) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });

  if (!res.ok) {
    let msg = `Error ${res.status}`;
    let detalle: unknown;
    try {
      const data = await res.json();
      msg = (data.message && (Array.isArray(data.message) ? data.message[0] : data.message)) ?? data.error ?? msg;
      detalle = data.detalle ?? data.message;
    } catch {
      /* sin cuerpo JSON */
    }
    throw new ApiError(res.status, msg, detalle);
  }

  if (res.status === 204) return undefined as T;
  const ct = res.headers.get('content-type') ?? '';
  return (ct.includes('application/json') ? await res.json() : await res.text()) as T;
}

export const api = {
  get: <T>(p: string) => request<T>('GET', p),
  post: <T>(p: string, body?: unknown) => request<T>('POST', p, body),
  put: <T>(p: string, body?: unknown) => request<T>('PUT', p, body),
  del: <T>(p: string) => request<T>('DELETE', p),
};
