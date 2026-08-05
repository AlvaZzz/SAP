/**
 * E2E de la GAMIFICACIÓN AVANZADA del rol estudiante (contra el stack Docker):
 *
 *   emblemas con estado (desbloqueado/bloqueado + requisito) · otorgamiento en
 *   backend al resolver · rangos por unidad + rango global con progreso al
 *   siguiente · progreso detallado por unidad/tema.
 *
 * Requiere: docker compose up -d (API en :4000 con la BD sembrada: seed.ts).
 */

const BASE = process.env.E2E_API_URL ?? 'http://localhost:4000/api';
const PASS_SEED = 'Prexi123*';

/**
 * `respuestaCorrecta` puede traer VARIANTES equivalentes separadas por "|"
 * (ej. "i in range(10)|i in range(0,10)"). Reenviar la cadena completa no
 * coincide con ninguna: hay que mandar una sola variante.
 */
function primeraVariante(respuesta: string): string {
  return String(respuesta).split('|')[0];
}

async function req(method: string, path: string, opts: { token?: string; body?: unknown } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const ct = res.headers.get('content-type') ?? '';
  const data = ct.includes('json') ? await res.json() : await res.text();
  return { status: res.status, data };
}

async function login(email: string) {
  const r = await req('POST', '/auth/login', { body: { email, password: PASS_SEED } });
  if (r.status !== 201 && r.status !== 200) throw new Error(`login ${email} → ${r.status}`);
  return r.data.token as string;
}

const stamp = Date.now();
let estudianteTk: string;

beforeAll(async () => {
  const salud = await fetch(`${BASE}/health`).catch(() => null);
  if (!salud?.ok) throw new Error(`La API no responde en ${BASE}. Levanta el stack: docker compose up -d`);
  // Estudiante nuevo (sin emblemas) para verificar el otorgamiento desde cero.
  const reg = await req('POST', '/auth/register', {
    body: { nombre: 'Gami E2E', email: `gami.${stamp}@test.bo`, password: 'segura123', cedula: String(stamp).slice(-8), carrera: 'Sistemas', paralelo: 'A' },
  });
  estudianteTk = reg.data.token;
});

describe('1 · Emblemas: catálogo con estado y requisito visible', () => {
  it('lista los 16 emblemas del catálogo; el estudiante nuevo no tiene ninguno', async () => {
    const r = await req('GET', '/gamificacion/emblemas', { token: estudianteTk });
    expect(r.status).toBe(200);
    expect(r.data.total).toBe(16);
    expect(r.data.desbloqueados).toBe(0);
    // Cada emblema trae su requisito (condicion) y su ícono SVG (svgKey).
    for (const e of r.data.emblemas) {
      expect(typeof e.condicion).toBe('string');
      expect(e.condicion.length).toBeGreaterThan(0);
      expect(typeof e.svgKey).toBe('string');
    }
  });
});

describe('2 · Otorgamiento en el backend al resolver', () => {
  let ejercicioId = -1;

  it('resolver el primer ejercicio correctamente otorga "primer_acierto"', async () => {
    const lista = await req('GET', '/ejercicios?nivel=1', { token: estudianteTk });
    ejercicioId = lista.data.ejercicios[0].id;
    // Aprende la respuesta con un intento inválido.
    const mal = await req('POST', '/intentos', { token: estudianteTk, body: { ejercicioId, respuestaDada: '~~' } });
    expect(mal.data.correcto).toBe(false);
    const bien = await req('POST', '/intentos', { token: estudianteTk, body: { ejercicioId, respuestaDada: primeraVariante(mal.data.respuesta_correcta) } });
    expect(bien.status).toBe(201);
    expect(bien.data.correcto).toBe(true);
    // El resultado trae los emblemas nuevos para la animación de "¡Logro desbloqueado!".
    expect(Array.isArray(bien.data.emblemas_nuevos)).toBe(true);
    expect(bien.data.emblemas_nuevos.map((e: { clave: string }) => e.clave)).toContain('primer_acierto');
  });

  it('el emblema ya no se re-otorga en el siguiente acierto (sin duplicar)', async () => {
    const lista = await req('GET', '/ejercicios?nivel=1', { token: estudianteTk });
    const otro = lista.data.ejercicios[1].id;
    const mal = await req('POST', '/intentos', { token: estudianteTk, body: { ejercicioId: otro, respuestaDada: '~~' } });
    const bien = await req('POST', '/intentos', { token: estudianteTk, body: { ejercicioId: otro, respuestaDada: primeraVariante(mal.data.respuesta_correcta) } });
    expect(bien.data.emblemas_nuevos.map((e: { clave: string }) => e.clave)).not.toContain('primer_acierto');

    // Y en el catálogo ya figura como desbloqueado (persistido, sin duplicar).
    const emb = await req('GET', '/gamificacion/emblemas', { token: estudianteTk });
    const primer = emb.data.emblemas.find((e: { clave: string }) => e.clave === 'primer_acierto');
    expect(primer.obtenido).toBe(true);
    expect(emb.data.desbloqueados).toBeGreaterThanOrEqual(1);
  });
});

describe('3 · Rangos por unidad y rango global', () => {
  it('expone el rango global con progreso al siguiente (estudiante nuevo = Aprendiz)', async () => {
    const r = await req('GET', '/gamificacion/rangos', { token: estudianteTk });
    expect(r.status).toBe(200);
    expect(r.data.global.rango.clave).toBe('aprendiz');
    expect(r.data.global.siguiente.clave).toBe('junior');
    expect(r.data.global.siguiente.faltan).toBeGreaterThan(0);
    expect(Array.isArray(r.data.unidades)).toBe(true);
  });

  it('el catálogo de rangos trae los 6 niveles ordenados con umbral e ícono', async () => {
    const r = await req('GET', '/gamificacion/rangos/catalogo', { token: estudianteTk });
    expect(r.status).toBe(200);
    expect(r.data.rangos).toHaveLength(6);
    const claves = r.data.rangos.map((x: { clave: string }) => x.clave);
    expect(claves).toEqual(['aprendiz', 'junior', 'semi_senior', 'senior', 'arquitecto', 'maestro']);
    expect(r.data.rangos[0].umbral).toBe(0);
    expect(r.data.rangos[5].umbral).toBeGreaterThan(r.data.rangos[0].umbral);
  });
});

describe('4 · Progreso detallado por unidad/tema', () => {
  it('devuelve la estructura por unidad→tema (vacía si no hay unidades publicadas)', async () => {
    const r = await req('GET', '/progreso/detalle', { token: estudianteTk });
    expect(r.status).toBe(200);
    expect(Array.isArray(r.data.unidades)).toBe(true);
    // Cada unidad (si existe) trae sus temas con dominio y promedio grupal.
    for (const u of r.data.unidades) {
      for (const t of u.temas) {
        expect(t).toHaveProperty('dominio');
        expect(t).toHaveProperty('promedio_grupal');
      }
    }
  });
});
