/**
 * E2E de las mejoras del rol docente / estudiante (contra el stack Docker):
 *
 *   control docente del POSTEST por paralelo (gate + notificación) · ADAPTATIVIDAD
 *   de la ruta (orden por dificultad + registro de la secuencia) · ejercicios por
 *   subtema.
 *
 * Requiere: docker compose up -d (API en :4000 con la BD sembrada: seed.ts).
 */

const BASE = process.env.E2E_API_URL ?? 'http://localhost:4000/api';
const PASS_SEED = 'Prexi123*';

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
const PAR = `Z${stamp % 10000}`; // paralelo único
let docenteTk: string;
let estudianteTk: string;
let estudianteId = -1;

beforeAll(async () => {
  const salud = await fetch(`${BASE}/health`).catch(() => null);
  if (!salud?.ok) throw new Error(`La API no responde en ${BASE}. Levanta: docker compose up -d`);
  docenteTk = await login('docente@upea.edu.bo');
  const reg = await req('POST', '/auth/register', {
    body: { nombre: 'Mejoras E2E', email: `mejoras.${stamp}@test.bo`, password: 'segura123', cedula: String(stamp).slice(-8), carrera: 'Sistemas', paralelo: PAR },
  });
  estudianteTk = reg.data.token;
  estudianteId = reg.data.usuario.id;
});

afterAll(async () => {
  // Deshabilita el postest del paralelo de prueba.
  await req('POST', '/docente/postest', { token: docenteTk, body: { paralelo: PAR, habilitado: false } });
});

describe('1 · Control docente de la evaluación final (postest)', () => {
  it('por defecto el postest del estudiante está DESHABILITADO', async () => {
    const e = await req('GET', '/postest/estado', { token: estudianteTk });
    expect(e.status).toBe(200);
    expect(e.data.habilitado).toBe(false);
    expect(e.data.disponible).toBe(false);
    // No puede pedir preguntas.
    const q = await req('GET', '/postest/preguntas', { token: estudianteTk });
    expect(q.status).toBe(400);
    expect(q.data.message).toMatch(/docente la habilite/);
  });

  it('el paralelo del estudiante aparece en el panel del docente como bloqueado', async () => {
    const r = await req('GET', '/docente/postest', { token: docenteTk });
    expect(r.status).toBe(200);
    const fila = r.data.paralelos.find((p: { paralelo: string }) => p.paralelo === PAR);
    expect(fila).toBeDefined();
    expect(fila.habilitado).toBe(false);
    expect(fila.total_estudiantes).toBeGreaterThanOrEqual(1);
  });

  it('un estudiante NO puede tocar el control del docente (guard de rol)', async () => {
    const r = await req('POST', '/docente/postest', { token: estudianteTk, body: { paralelo: PAR, habilitado: true } });
    expect(r.status).toBe(403);
  });

  it('al habilitar el docente el paralelo, el estudiante YA puede y recibe notificación', async () => {
    const hab = await req('POST', '/docente/postest', { token: docenteTk, body: { paralelo: PAR, habilitado: true } });
    expect(hab.status).toBe(201);
    expect(hab.data.notificados).toBeGreaterThanOrEqual(1);

    const e = await req('GET', '/postest/estado', { token: estudianteTk });
    expect(e.data.habilitado).toBe(true);
    expect(e.data.disponible).toBe(true);

    // Le llegó la notificación por la campana.
    const notis = await req('GET', '/notificaciones', { token: estudianteTk });
    expect(JSON.stringify(notis.data)).toMatch(/evaluación final/i);
  });

  it('al deshabilitar de nuevo, vuelve a bloquearse', async () => {
    const off = await req('POST', '/docente/postest', { token: docenteTk, body: { paralelo: PAR, habilitado: false } });
    expect(off.status).toBe(201);
    const e = await req('GET', '/postest/estado', { token: estudianteTk });
    expect(e.data.disponible).toBe(false);
  });
});

describe('2 · Adaptatividad de la ruta de ejercicios', () => {
  it('la ruta devuelve el banco de práctica ordenado por dificultad', async () => {
    const r = await req('GET', '/ejercicios/ruta?nivel=1', { token: estudianteTk });
    expect(r.status).toBe(200);
    expect(Array.isArray(r.data.ejercicios)).toBe(true);
    expect(r.data.ejercicios.length).toBeGreaterThan(0);
    expect(typeof r.data.pendientes).toBe('number');
    // θ puede ser null (estudiante nuevo sin intentos ni pretest) o número.
    expect(r.data.theta === null || typeof r.data.theta === 'number').toBe(true);
    // Estudiante nuevo → la ruta arranca por los ejercicios más fáciles.
    expect(r.data.ejercicios[0].estrellas).toBeLessThanOrEqual(3);
  });

  it('cada intento registra un paso en la ruta (evidencia para la tesis)', async () => {
    const lista = await req('GET', '/ejercicios?nivel=1', { token: estudianteTk });
    const ej = lista.data.ejercicios[0];
    // Un intento (correcto o no) debe registrarse.
    const det = await req('GET', `/docente/ejercicios/${ej.id}`, { token: docenteTk });
    const correcta = det.data.ejercicio.respuestaCorrecta;
    await req('POST', '/intentos', { token: estudianteTk, body: { ejercicioId: ej.id, respuestaDada: correcta, tiempoSeg: 5 } });

    const ruta = await req('GET', '/ejercicios/mi-ruta', { token: estudianteTk });
    expect(ruta.status).toBe(200);
    expect(ruta.data.pasos.length).toBeGreaterThanOrEqual(1);
    const paso = ruta.data.pasos[ruta.data.pasos.length - 1];
    // El nivel es discreto por tema (Básico/Intermedio/Avanzado); el paso registra
    // el ejercicio, su nivel y el resultado como evidencia de la ruta.
    expect(paso).toHaveProperty('nivel');
    expect(paso.ejercicioId).toBe(ej.id);
  });
});
