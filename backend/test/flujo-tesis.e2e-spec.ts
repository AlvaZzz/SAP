/**
 * E2E DEL FLUJO CRÍTICO DE LA TESIS (contra el stack Docker real):
 *
 *   registro → pretest (respuestas reales, puntaje real) → ejercicios (XP) →
 *   postest (ganancia real) → datos visibles para docente/investigador →
 *   exportación CSV correcta.
 *
 * Además: guards de rol entre los 4 roles, sesión sin token, entradas
 * inválidas, doble envío y el bug conocido "postest salta al resultado sin
 * responder" (debe seguir bloqueado).
 *
 * Requiere: docker compose up -d (API en :4000 con la BD sembrada: seed.ts).
 */

const BASE = process.env.E2E_API_URL ?? 'http://localhost:4000/api';
const PASS_SEED = 'Prexi123*'; // contraseña del seed (usuarios demo)

interface Sesion { token: string; usuario: { id: number; rol: string; email: string } }

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

async function login(email: string): Promise<Sesion> {
  const r = await req('POST', '/auth/login', { body: { email, password: PASS_SEED } });
  if (r.status !== 201 && r.status !== 200) throw new Error(`login ${email} → ${r.status}: ${JSON.stringify(r.data)}`);
  return { token: r.data.token, usuario: r.data.usuario };
}

// Estado compartido del flujo (secuencial con --runInBand).
const stamp = Date.now();
const EMAIL = `e2e.${stamp}@test.prexi.bo`;
let estudiante: Sesion;
let docente: Sesion;
let admin: Sesion;
let investigador: Sesion;
let puntajePretest = -1;
let puntajePostest = -1;
let configOriginal: { umbralPorcentaje: number; postestDesdeNivel: number };

/**
 * Responde un ejercicio de práctica: primero con una opción inválida (aprende
 * la respuesta correcta que devuelve el backend) y luego correctamente.
 */
async function resolverEjercicio(id: number) {
  const mal = await req('POST', '/intentos', { token: estudiante.token, body: { ejercicioId: id, respuestaDada: '~~', tiempoSeg: 5 } });
  expect(mal.status).toBe(201);
  expect(mal.data.correcto).toBe(false);
  expect(mal.data.xp.xpOtorgado).toBe(0);
  const bien = await req('POST', '/intentos', { token: estudiante.token, body: { ejercicioId: id, respuestaDada: mal.data.respuesta_correcta, tiempoSeg: 8 } });
  expect(bien.status).toBe(201);
  expect(bien.data.correcto).toBe(true);
  expect(bien.data.xp.xpOtorgado).toBeGreaterThan(0);
  return bien.data;
}

beforeAll(async () => {
  const salud = await fetch(`${BASE}/health`).catch(() => null);
  if (!salud?.ok) throw new Error(`La API no responde en ${BASE}. Levanta el stack: docker compose up -d`);
  docente = await login('docente@upea.edu.bo');
  admin = await login('admin@upea.edu.bo');
  investigador = await login('investigador@upea.edu.bo');

  // Guarda la config para restaurarla al final (el flujo la ajusta para
  // habilitar el postest sin resolver decenas de ejercicios).
  const cfg = await req('GET', '/admin/config', { token: admin.token });
  const c = cfg.data.config ?? cfg.data;
  configOriginal = {
    umbralPorcentaje: c.umbralPorcentaje ?? 80,
    postestDesdeNivel: c.postestDesdeNivel ?? 3,
  };
});

afterAll(async () => {
  if (admin && configOriginal) {
    await req('PUT', '/admin/config', { token: admin.token, body: configOriginal });
    // Restaura el control del postest para no filtrar estado entre corridas.
    await req('POST', '/docente/postest', { token: admin.token, body: { paralelo: 'A', habilitado: false } });
  }
});

describe('1 · Registro con validaciones', () => {
  it('rechaza un correo con formato inválido (400, mensaje en español)', async () => {
    const r = await req('POST', '/auth/register', { body: { nombre: 'X Y', email: 'no-es-correo', password: '123456', cedula: '99999901', carrera: 'Sistemas', paralelo: 'A' } });
    expect(r.status).toBe(400);
    expect(JSON.stringify(r.data.message)).toMatch(/[Cc]orreo/);
  });

  it('rechaza propiedades extra no permitidas (whitelist del ValidationPipe)', async () => {
    const r = await req('POST', '/auth/register', { body: { nombre: 'X Y', email: EMAIL, password: '123456', cedula: '99999902', carrera: 'Sistemas', rol: 'admin' } });
    expect(r.status).toBe(400); // no se puede auto-asignar rol
  });

  it('registra al estudiante nuevo y devuelve token', async () => {
    const r = await req('POST', '/auth/register', { body: { nombre: 'Estudiante E2E', email: EMAIL, password: 'segura123', cedula: String(stamp).slice(-8), carrera: 'Ingeniería de Sistemas', paralelo: 'A' } });
    expect(r.status).toBe(201);
    expect(r.data.usuario.rol).toBe('estudiante');
    expect(r.data.usuario.pretestCompletado).toBe(false);
    estudiante = { token: r.data.token, usuario: r.data.usuario };
  });

  it('rechaza un registro duplicado con mensaje claro', async () => {
    const r = await req('POST', '/auth/register', { body: { nombre: 'Otro', email: EMAIL, password: '123456', cedula: '99999903', carrera: 'Sistemas', paralelo: 'A' } });
    expect(r.status).toBe(400);
    expect(r.data.message).toMatch(/Ya existe/);
  });
});

describe('2 · Guards: separación estricta de los 4 roles', () => {
  it('sin token → 401 en rutas protegidas (sesión expirada)', async () => {
    for (const ruta of ['/pretest/estado', '/progreso', '/docente/dashboard', '/admin/usuarios']) {
      const r = await req('GET', ruta);
      expect(r.status).toBe(401);
    }
  });

  it('el ESTUDIANTE no accede a rutas de docente/admin/investigador (403)', async () => {
    for (const ruta of ['/docente/dashboard', '/docente/estudiantes', '/admin/usuarios', '/admin/config', '/investigador/panel', '/progreso/export.csv']) {
      const r = await req('GET', ruta, { token: estudiante.token });
      expect(r.status).toBe(403);
    }
  });

  it('el INVESTIGADOR no accede a rutas de docente/admin', async () => {
    for (const ruta of ['/docente/dashboard', '/admin/usuarios', '/admin/config']) {
      const r = await req('GET', ruta, { token: investigador.token });
      expect(r.status).toBe(403);
    }
  });

  it('el DOCENTE no accede a rutas de admin', async () => {
    for (const ruta of ['/admin/usuarios', '/admin/config', '/admin/auditoria']) {
      const r = await req('GET', ruta, { token: docente.token });
      expect(r.status).toBe(403);
    }
  });
});

describe('3 · Diagnóstico por tema: introducción, responde y estima nivel por tema', () => {
  let preguntas: { id: number; tema: { numero: string } | null }[] = [];

  it('GATE: el diagnóstico está bloqueado hasta revisar la introducción', async () => {
    const bloqueado = await req('GET', '/pretest/preguntas', { token: estudiante.token });
    expect(bloqueado.status).toBe(400);
    // La introducción sirve las 5 unidades con su contenido didáctico.
    const intro = await req('GET', '/introduccion', { token: estudiante.token });
    expect(intro.status).toBe(200);
    expect(intro.data.unidades.length).toBeGreaterThanOrEqual(5);
    const ok = await req('POST', '/introduccion/completar', { token: estudiante.token, body: {} });
    expect(ok.status).toBe(201);
  });

  it('entrega las preguntas del diagnóstico por tema SIN filtrar la respuesta correcta', async () => {
    const r = await req('GET', '/pretest/preguntas', { token: estudiante.token });
    expect(r.status).toBe(200);
    preguntas = r.data.preguntas;
    expect(preguntas.length).toBeGreaterThanOrEqual(9); // ≥3 temas × 3
    expect(r.data.total).toBe(preguntas.length);
    // Cada pregunta trae su tema (evaluación por tema del temario).
    expect(preguntas.every((p) => p.tema && p.tema.numero)).toBe(true);
    expect(JSON.stringify(r.data)).not.toMatch(/respuestaCorrecta|respuesta_correcta/);
  });

  it('SEGURIDAD: la revisión (con respuestas correctas) está bloqueada durante el examen', async () => {
    const r = await req('GET', '/pretest/revision', { token: estudiante.token });
    expect(r.status).toBe(400);
  });

  it('rechaza responder una pregunta ajena al pretest fijado', async () => {
    const r = await req('POST', '/pretest/responder', { token: estudiante.token, body: { ejercicioId: 999999, opcion: 'A' } });
    expect(r.status).toBe(400);
  });

  it('responde todas las preguntas con autosave (todas con la opción A)', async () => {
    for (const p of preguntas) {
      const r = await req('POST', '/pretest/responder', { token: estudiante.token, body: { ejercicioId: p.id, opcion: 'A' } });
      expect(r.status).toBe(201);
    }
  });

  it('finalizar estima el nivel POR TEMA (IRT) y un puntaje global consistente', async () => {
    const r = await req('POST', '/pretest/finalizar', { token: estudiante.token, body: { tiempoSeg: 480 } });
    expect(r.status).toBe(201);
    const res = r.data.resultado;
    puntajePretest = res.puntaje;
    expect(res.total).toBe(preguntas.length);
    expect(res.puntaje).toBe(Math.round((res.aciertos / res.total) * 100));
    // Desglose por tema con nivel (Básico/Intermedio/Avanzado) y θ.
    expect(res.por_tema.length).toBeGreaterThanOrEqual(3);
    expect(res.por_tema.every((t: { nivel: string; nivel_label: string }) => !!t.nivel && !!t.nivel_label)).toBe(true);
    expect(typeof res.theta === 'number' || res.theta === null).toBe(true);

    // La revisión (ahora sí permitida) debe coincidir 1:1 con el puntaje.
    const rev = await req('GET', '/pretest/revision', { token: estudiante.token });
    expect(rev.status).toBe(200);
    const correctas = rev.data.revision.filter((x: { correcto: boolean }) => x.correcto).length;
    expect(correctas).toBe(res.aciertos);
  });

  it('el estado LEE el resultado persistido (no lo recalcula a 0)', async () => {
    const r = await req('GET', '/pretest/estado', { token: estudiante.token });
    expect(r.status).toBe(200);
    expect(r.data.completado).toBe(true);
    expect(r.data.resultado.puntaje).toBe(puntajePretest);
  });

  it('no permite repetir ni alterar un pretest completado', async () => {
    const rep = await req('GET', '/pretest/preguntas', { token: estudiante.token });
    expect(rep.status).toBe(400);
    const alt = await req('POST', '/pretest/responder', { token: estudiante.token, body: { ejercicioId: preguntas[0].id, opcion: 'B' } });
    expect(alt.status).toBe(400);
  });
});

describe('4 · Ejercicios: corrección en backend, XP y progreso', () => {
  it('lista los niveles con el nivel 1 desbloqueado', async () => {
    const r = await req('GET', '/niveles', { token: estudiante.token });
    expect(r.status).toBe(200);
    const n1 = r.data.niveles.find((n: { numero: number }) => n.numero === 1);
    expect(n1.desbloqueado).toBe(true);
  });

  it('incorrecta = 0 XP; correcta = XP > 0 y aparece en el ranking', async () => {
    const lista = await req('GET', '/ejercicios?nivel=1', { token: estudiante.token });
    expect(lista.status).toBe(200);
    const ejercicios = lista.data.ejercicios;
    expect(ejercicios.length).toBeGreaterThan(0);
    await resolverEjercicio(ejercicios[0].id);

    const rk = await req('GET', '/ranking', { token: estudiante.token });
    expect(rk.status).toBe(200);
    expect(JSON.stringify(rk.data)).toContain('Estudiante E2E');
  });

  it('rechaza resolver ejercicios de un nivel bloqueado', async () => {
    const lista = await req('GET', '/ejercicios?nivel=5', { token: estudiante.token });
    const ej = lista.data.ejercicios?.[0];
    if (!ej) return; // sin ejercicios en nivel 5, nada que probar
    const r = await req('POST', '/intentos', { token: estudiante.token, body: { ejercicioId: ej.id, respuestaDada: 'A' } });
    expect(r.status).toBe(403);
  });
});

describe('5 · Postest: candados, respuestas y GANANCIA real', () => {
  it('con la config por defecto el postest NO está disponible aún', async () => {
    const r = await req('GET', '/postest/estado', { token: estudiante.token });
    expect(r.status).toBe(200);
    expect(r.data.completado).toBe(false);
    // Bloqueado: pedir preguntas debe fallar, no "saltar al resultado".
    const q = await req('GET', '/postest/preguntas', { token: estudiante.token });
    expect(q.status).toBe(400);
  });

  it('BUG conocido: finalizar sin haber abierto preguntas NO salta al resultado', async () => {
    // El docente/admin HABILITA la evaluación final para el paralelo del estudiante (gate principal).
    const hab = await req('POST', '/docente/postest', { token: admin.token, body: { paralelo: 'A', habilitado: true } });
    expect(hab.status).toBe(201);

    const estado = await req('GET', '/postest/estado', { token: estudiante.token });
    expect(estado.data.disponible).toBe(true);
    expect(estado.data.habilitado).toBe(true);

    // Habilitado pero en BLANCO (sin responder) → finalizar debe rechazarse.
    const fin = await req('POST', '/postest/finalizar', { token: estudiante.token, body: {} });
    expect(fin.status).toBe(400);
    expect(fin.data.message).toMatch(/Responde al menos una pregunta/);
  });

  it('responde el postest y la ganancia es exactamente postest − pretest', async () => {
    const r = await req('GET', '/postest/preguntas', { token: estudiante.token });
    expect(r.status).toBe(200);
    const preguntas: { id: number }[] = r.data.preguntas;
    expect(preguntas).toHaveLength(20);
    expect(JSON.stringify(r.data)).not.toMatch(/respuestaCorrecta|respuesta_correcta/);

    // La revisión sigue bloqueada durante el examen.
    const rev = await req('GET', '/postest/revision', { token: estudiante.token });
    expect(rev.status).toBe(400);

    for (const p of preguntas) {
      const resp = await req('POST', '/postest/responder', { token: estudiante.token, body: { ejercicioId: p.id, opcion: 'B' } });
      expect(resp.status).toBe(201);
    }

    const fin = await req('POST', '/postest/finalizar', { token: estudiante.token, body: { tiempoSeg: 600 } });
    expect(fin.status).toBe(201);
    const res = fin.data.resultado;
    puntajePostest = res.puntaje;
    expect(res.total).toBe(20);
    expect(res.puntaje).toBe(Math.round((res.aciertos / res.total) * 100));
    expect(res.ganancia).toBe(puntajePostest - puntajePretest);

    // Consistencia con la revisión (ya permitida).
    const rev2 = await req('GET', '/postest/revision', { token: estudiante.token });
    const correctas = rev2.data.revision.filter((x: { correcto: boolean }) => x.correcto).length;
    expect(correctas).toBe(res.aciertos);
  });

  it('no permite rendir el postest dos veces (doble envío)', async () => {
    const otra = await req('GET', '/postest/preguntas', { token: estudiante.token });
    expect(otra.status).toBe(400);
    const fin2 = await req('POST', '/postest/finalizar', { token: estudiante.token, body: {} });
    expect(fin2.status).toBe(400);
    const alt = await req('POST', '/postest/responder', { token: estudiante.token, body: { ejercicioId: 1, opcion: 'A' } });
    expect(alt.status).toBe(400);
  });

  it('el progreso del estudiante refleja pretest, postest y ganancia persistidos', async () => {
    const r = await req('GET', '/progreso', { token: estudiante.token });
    expect(r.status).toBe(200);
    expect(r.data.pretest_total).toBe(puntajePretest);
    expect(r.data.postest_total).toBe(puntajePostest);
    expect(r.data.ganancia).toBe(puntajePostest - puntajePretest);
  });
});

describe('6 · Los datos llegan a docente e investigador + CSV', () => {
  it('el docente ve al estudiante nuevo en su seguimiento', async () => {
    const r = await req('GET', '/docente/estudiantes', { token: docente.token });
    expect(r.status).toBe(200);
    expect(JSON.stringify(r.data)).toContain('Estudiante E2E');
  });

  it('la exportación CSV (docente) contiene el pretest, postest y ganancia reales', async () => {
    const r = await req('GET', '/progreso/export.csv', { token: docente.token });
    expect(r.status).toBe(200);
    const linea = (r.data as string).split('\n').find((l) => l.includes('Estudiante E2E') && l.startsWith(String(estudiante.usuario.id)));
    expect(linea).toBeDefined();
    const cols = (linea as string).split(',');
    // usuario_id,nombre,grupo,puntaje_pretest,tiempo_pre,puntaje_postest,tiempo_post,ganancia
    expect(Number(cols[3])).toBe(puntajePretest);
    expect(Number(cols[5])).toBe(puntajePostest);
    expect(Number(cols[7])).toBe(puntajePostest - puntajePretest);
  });

  it('el investigador accede a su panel y al dataset de exportación', async () => {
    const panel = await req('GET', '/investigador/panel', { token: investigador.token });
    expect(panel.status).toBe(200);
    const exp = await req('GET', '/investigador/exportacion/dataset', { token: investigador.token });
    expect(exp.status).toBe(200);
    const csv = await req('GET', '/investigador/exportacion/export.csv', { token: investigador.token });
    expect(csv.status).toBe(200);
  });
});

describe('7 · Tours de onboarding persistidos por usuario', () => {
  it('empiezan vacíos, se marcan y se reinician', async () => {
    const v0 = await req('GET', '/auth/tours', { token: estudiante.token });
    expect(v0.status).toBe(200);
    expect(v0.data.vistos).toEqual([]);

    await req('POST', '/auth/tours', { token: estudiante.token, body: { clave: 'bienvenida' } });
    await req('POST', '/auth/tours', { token: estudiante.token, body: { clave: 'bienvenida' } }); // idempotente
    await req('POST', '/auth/tours', { token: estudiante.token, body: { clave: 'dashboard' } });

    const v1 = await req('GET', '/auth/tours', { token: estudiante.token });
    expect(v1.data.vistos).toEqual(['bienvenida', 'dashboard']);

    const rst = await req('DELETE', '/auth/tours', { token: estudiante.token });
    expect(rst.status).toBe(200);
    const v2 = await req('GET', '/auth/tours', { token: estudiante.token });
    expect(v2.data.vistos).toEqual([]);
  });

  it('valida la clave (vacía → 400)', async () => {
    const r = await req('POST', '/auth/tours', { token: estudiante.token, body: { clave: '' } });
    expect(r.status).toBe(400);
  });
});
