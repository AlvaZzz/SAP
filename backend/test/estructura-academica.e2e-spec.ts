/**
 * E2E de la ampliación del rol DOCENTE (contra el stack Docker real):
 *
 *   Unidad → Tema (mínimo 10 ejercicios para publicar) → el estudiante los
 *   resuelve con los NUEVOS TIPOS de pregunta (completar_codigo,
 *   ordenar_lineas) → desbloqueo por tema → asignación de grupo por paralelo.
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

async function crearEjercicioRelleno(token: string, temaId: number, i: number) {
  const r = await req('POST', '/docente/ejercicios', {
    token,
    body: {
      titulo: `Relleno E2E ${i}`, categoria: 'Variables', temaId, estrellas: 1, tipo: 'opcion_multiple',
      enunciado: `Ejercicio de relleno ${i}`,
      opciones: [{ id: 'A', texto: 'Uno' }, { id: 'B', texto: 'Dos' }],
      respuestaCorrecta: 'A', xp: 20,
    },
  });
  expect(r.status).toBe(201);
  const id = r.data.ejercicio.id as number;
  ejerciciosCreados.push(id);
  return id;
}

/**
 * Ejercicios creados por esta suite. Hay que borrarlos EXPLICITAMENTE: al
 * eliminar su tema, el ejercicio no se borra en cascada sino que se queda con
 * `temaId = null`. Cada ejecucion dejaba asi una tanda de huerfanos "Ejercicio
 * de relleno N" que la auditoria denunciaba despues como items de opcion con 2
 * opciones — es decir, la propia suite ensuciaba la validacion siguiente.
 */
const ejerciciosCreados: number[] = [];

const stamp = Date.now();
let docenteTk: string;
let adminTk: string;
let estudianteTk: string;
let unidadId = -1;
let temaId = -1;
let tema2Id = -1;
let ejercicioComplId = -1;
let ejercicioOrdenId = -1;

beforeAll(async () => {
  const salud = await fetch(`${BASE}/health`).catch(() => null);
  if (!salud?.ok) throw new Error(`La API no responde en ${BASE}. Levanta el stack: docker compose up -d`);
  docenteTk = await login('docente@upea.edu.bo');
  adminTk = await login('admin@upea.edu.bo');
  estudianteTk = await login('juan@upea.edu.bo');
});

// Limpia lo creado: evita que unidades de ejecuciones previas alteren cuál es
// "la primera unidad" (regla de desbloqueo por defecto) en la siguiente corrida.
afterAll(async () => {
  // Primero los ejercicios: despues de borrar el tema quedarian sin tema y ya no
  // habria forma de distinguirlos del contenido real.
  for (const id of ejerciciosCreados) {
    await req('DELETE', `/docente/ejercicios/${id}`, { token: docenteTk });
  }
  if (tema2Id > 0) await req('DELETE', `/docente/unidades/temas/${tema2Id}`, { token: docenteTk });
  if (temaId > 0) await req('DELETE', `/docente/unidades/temas/${temaId}`, { token: docenteTk });
  if (unidadId > 0) await req('DELETE', `/docente/unidades/${unidadId}`, { token: docenteTk });
});

describe('1 · Unidad → Tema: creación y regla de publicación (mínimo 10 ejercicios)', () => {
  it('el docente crea una unidad', async () => {
    // orden: 0 → esta unidad de prueba queda PRIMERA (antes que el plan sembrado
    // UPEA), de modo que su primer tema se autodesbloquee para el estudiante y se
    // pueda probar la calificación de los ejercicios. Se elimina en afterAll.
    const r = await req('POST', '/docente/unidades', { token: docenteTk, body: { numero: 900 + (stamp % 100), titulo: `Unidad E2E ${stamp}`, xp: 30, orden: 0 } });
    expect(r.status).toBe(201);
    unidadId = r.data.unidad.id;
  });

  it('rechaza una unidad con número duplicado', async () => {
    const r = await req('POST', '/docente/unidades', { token: docenteTk, body: { numero: 900 + (stamp % 100), titulo: 'Duplicada' } });
    expect(r.status).toBe(400);
  });

  it('el docente crea un tema dentro de la unidad', async () => {
    const r = await req('POST', `/docente/unidades/${unidadId}/temas`, { token: docenteTk, body: { numero: '900.1', titulo: 'Tema E2E', umbral: 3 } });
    expect(r.status).toBe(201);
    temaId = r.data.tema.id;
    expect(r.data.tema.publicado).toBe(false);
  });

  it('un estudiante NO puede ver el módulo de gestión (guard de rol)', async () => {
    const r = await req('GET', '/docente/unidades', { token: estudianteTk });
    expect(r.status).toBe(403);
  });
});

describe('2 · Nuevos tipos de pregunta: se crean sin publicar el tema todavía', () => {
  it('crea un ejercicio "completar_codigo" sin necesitar opciones', async () => {
    const r = await req('POST', '/docente/ejercicios', {
      token: docenteTk,
      body: {
        titulo: 'Completar E2E', categoria: 'Bucles', temaId, estrellas: 2, tipo: 'completar_codigo',
        enunciado: 'Completa el bucle que recorre 10 veces', codigoPython: 'for ___:\n    print(i)',
        respuestaCorrecta: 'i in range(10)|i in range(0,10)', xp: 40,
      },
    });
    expect(r.status).toBe(201);
    ejercicioComplId = r.data.ejercicio.id;
    ejerciciosCreados.push(ejercicioComplId);
  });

  it('crea un ejercicio "ordenar_lineas" (Parsons) con las líneas en orden correcto', async () => {
    const r = await req('POST', '/docente/ejercicios', {
      token: docenteTk,
      body: {
        titulo: 'Ordenar E2E', categoria: 'Funciones', temaId, estrellas: 2, tipo: 'ordenar_lineas',
        enunciado: 'Ordena las líneas para definir una función que suma dos números',
        opciones: [
          { id: 'A', texto: 'def sumar(a, b):' },
          { id: 'B', texto: '    return a + b' },
        ],
        respuestaCorrecta: 'A,B', xp: 45,
      },
    });
    expect(r.status).toBe(201);
    ejercicioOrdenId = r.data.ejercicio.id;
    ejerciciosCreados.push(ejercicioOrdenId);
  });

  it('con solo 2 ejercicios el tema NO puede publicarse (mínimo 10)', async () => {
    const r = await req('PUT', `/docente/unidades/temas/${temaId}`, { token: docenteTk, body: { publicado: true } });
    expect(r.status).toBe(400);
    expect(r.data.message).toMatch(/2\/10/);
  });
});

describe('3 · Publicación del tema y calificación de los nuevos tipos', () => {
  it('al agregar 8 ejercicios más (10 en total) el tema SÍ puede publicarse', async () => {
    for (let i = 0; i < 8; i++) await crearEjercicioRelleno(docenteTk, temaId, i);
    const pub = await req('PUT', `/docente/unidades/temas/${temaId}`, { token: docenteTk, body: { publicado: true } });
    expect(pub.status).toBe(200);
    expect(pub.data.tema.publicado).toBe(true);
  });

  it('el estudiante ahora ve el tema en /unidades', async () => {
    const r = await req('GET', '/unidades', { token: estudianteTk });
    expect(r.status).toBe(200);
    const unidad = r.data.unidades.find((u: { id: number }) => u.id === unidadId);
    expect(unidad).toBeDefined();
    expect(unidad.temas.some((t: { id: number }) => t.id === temaId)).toBe(true);
  });

  it('completar_codigo: admite variantes equivalentes separadas por "|"', async () => {
    const mal = await req('POST', '/intentos', { token: estudianteTk, body: { ejercicioId: ejercicioComplId, respuestaDada: 'while True' } });
    expect(mal.status).toBe(201);
    expect(mal.data.correcto).toBe(false);

    const bien = await req('POST', '/intentos', { token: estudianteTk, body: { ejercicioId: ejercicioComplId, respuestaDada: 'i in range(0,10)' } });
    expect(bien.status).toBe(201);
    expect(bien.data.correcto).toBe(true);
  });

  it('ordenar_lineas: el orden incorrecto se marca mal y el correcto se acepta', async () => {
    const mal = await req('POST', '/intentos', { token: estudianteTk, body: { ejercicioId: ejercicioOrdenId, respuestaDada: 'B,A' } });
    expect(mal.status).toBe(201);
    expect(mal.data.correcto).toBe(false);

    const bien = await req('POST', '/intentos', { token: estudianteTk, body: { ejercicioId: ejercicioOrdenId, respuestaDada: 'A,B' } });
    expect(bien.status).toBe(201);
    expect(bien.data.correcto).toBe(true);
  });
});

describe('4 · Un segundo tema (no publicado / no es el primero) permanece bloqueado', () => {
  it('crea un segundo tema y un ejercicio en él, sin publicarlo', async () => {
    const t = await req('POST', `/docente/unidades/${unidadId}/temas`, { token: docenteTk, body: { numero: '900.2', titulo: 'Tema E2E 2', umbral: 3, orden: 2 } });
    expect(t.status).toBe(201);
    tema2Id = t.data.tema.id;
    const ej = await crearEjercicioRelleno(docenteTk, tema2Id, 99);
    const r = await req('POST', '/intentos', { token: estudianteTk, body: { ejercicioId: ej, respuestaDada: 'A' } });
    expect(r.status).toBe(403);
  });
});

describe('5 · Asignación de grupos de investigación por paralelo', () => {
  const paralelo = `E2E${stamp % 100000}`;

  it('registra 2 estudiantes en el mismo paralelo nuevo', async () => {
    for (let i = 0; i < 2; i++) {
      const r = await req('POST', '/auth/register', {
        body: {
          nombre: `Paralelo Test ${i}`, email: `paralelo${stamp}.${i}@test.bo`, password: 'segura123',
          cedula: `${stamp}${i}`.slice(-9), carrera: 'Sistemas', paralelo,
        },
      });
      expect(r.status).toBe(201);
    }
  });

  it('rechaza asignar un paralelo que no existe', async () => {
    const r = await req('POST', '/admin/grupos/asignar-paralelo', { token: adminTk, body: { paralelo: 'NO-EXISTE-XYZ', grupo: 'control' } });
    expect(r.status).toBe(400);
  });

  it('asigna el paralelo completo a "control" de una sola vez', async () => {
    const r = await req('POST', '/admin/grupos/asignar-paralelo', { token: adminTk, body: { paralelo, grupo: 'control' } });
    expect(r.status).toBe(201);
    expect(r.data.actualizados).toBe(2);
  });

  it('el conteo por paralelo refleja la asignación', async () => {
    const r = await req('GET', '/admin/grupos', { token: adminTk });
    expect(r.status).toBe(200);
    const fila = r.data.paralelos.find((p: { paralelo: string }) => p.paralelo === paralelo);
    expect(fila).toBeDefined();
    expect(fila.control).toBe(2);
    expect(fila.experimental).toBe(0);
  });
});
