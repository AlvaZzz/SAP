// Cliente HTTP. Llama a /api (mismo origen vía rewrite → API NestJS).
// La cookie httpOnly del JWT se envía/recibe automáticamente (credentials).

export class ApiError extends Error {
  constructor(public status: number, message: string, public detalle?: unknown) {
    super(message);
  }
  /** Segundos que faltan cuando el backend responde 429 (bloqueo temporal). */
  get retryAfterSeconds(): number | null {
    const d = this.detalle as { retryAfterSeconds?: number } | undefined;
    return typeof d?.retryAfterSeconds === 'number' ? d.retryAfterSeconds : null;
  }
}

/**
 * REFRESH SILENCIOSO. El access token dura 15 minutos; cuando caduca, el backend
 * responde 401. En vez de mandar al usuario al login, se canjea una vez la cookie
 * de refresh y se REPITE la petición original: si sigue activo, no nota nada.
 *
 * Se comparte una sola promesa entre llamadas concurrentes para no disparar N
 * refrescos a la vez (y evitar que la rotación del token invalide a los demás).
 */
let refrescando: Promise<boolean> | null = null;

function intentarRefresh(): Promise<boolean> {
  refrescando ??= fetch('/api/auth/refresh', { method: 'POST', credentials: 'include', cache: 'no-store' })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => { refrescando = null; });
  return refrescando;
}

/** Rutas donde un 401 es la respuesta esperada y NO debe disparar refresh. */
function esRutaDeSesion(path: string): boolean {
  return path.startsWith('/auth/login') || path.startsWith('/auth/refresh') || path.startsWith('/auth/logout');
}

async function request<T>(method: string, path: string, body?: unknown, reintento = false): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });

  // 401 por access token caducado → refrescar UNA vez y repetir la petición.
  if (res.status === 401 && !reintento && !esRutaDeSesion(path)) {
    if (await intentarRefresh()) return request<T>(method, path, body, true);
  }

  if (!res.ok) {
    let msg = `Error ${res.status}`;
    let detalle: unknown;
    try {
      const data = await res.json();
      msg = (data.message && (Array.isArray(data.message) ? data.message[0] : data.message)) ?? data.error ?? msg;
      // Se conserva el cuerpo completo: de ahí sale `retryAfterSeconds` en los 429.
      detalle = data.detalle ?? data;
    } catch {
      /* sin cuerpo JSON */
    }
    throw new ApiError(res.status, msg, detalle);
  }

  if (res.status === 204) return undefined as T;
  const ct = res.headers.get('content-type') ?? '';
  return (ct.includes('application/json') ? await res.json() : await res.text()) as T;
}

/** Subida multipart (archivos). El navegador fija el boundary; no forzar Content-Type. */
async function upload<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`/api${path}`, { method: 'POST', body: form, credentials: 'include', cache: 'no-store' });
  if (!res.ok) {
    let msg = `Error ${res.status}`;
    try { const d = await res.json(); msg = (Array.isArray(d.message) ? d.message[0] : d.message) ?? d.error ?? msg; } catch { /* sin JSON */ }
    throw new ApiError(res.status, msg);
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get('content-type') ?? '';
  return (ct.includes('application/json') ? await res.json() : await res.text()) as T;
}

export const api = {
  get: <T>(p: string) => request<T>('GET', p),
  post: <T>(p: string, body?: unknown) => request<T>('POST', p, body),
  put: <T>(p: string, body?: unknown) => request<T>('PUT', p, body),
  patch: <T>(p: string, body?: unknown) => request<T>('PATCH', p, body),
  del: <T>(p: string) => request<T>('DELETE', p),
  upload,
};
