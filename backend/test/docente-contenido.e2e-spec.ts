/**
 * E2E DEL CONTRATO DE CREACIÓN DE CONTENIDO DEL DOCENTE.
 *
 * Existe por un defecto que se rompió DOS VECES seguidas, una por cada lado:
 *
 *   1. El backend exigía `nivel` (1-5, el modelo de gamificación viejo) y el
 *      seed solo crea cinco filas de `Nivel`. Cualquier contenido de una unidad
 *      más allá de la quinta era imposible: "No existe el nivel 6".
 *   2. Al retirar `nivel` del DTO, el formulario del frontend siguió
 *      enviándolo. Como `main.ts` valida con `forbidNonWhitelisted: true`,
 *      la creación pasó a fallar con "property nivel should not exist".
 *
 * Ni los tipos ni el lint pueden ver esa desincronización: el formulario y el
 * DTO viven en proyectos distintos y solo se encuentran en tiempo de ejecución,
 * sobre una petición HTTP real. Esta suite es esa petición.
 *
 * Cubre además la INTEGRIDAD DEL TEXTO EN ESPAÑOL. El sistema guarda enunciados
 * que escribe el docente y respuestas que escribe el estudiante; si en algún
 * punto del recorrido se perdiera la codificación, se corromperían los datos de
 * la investigación. (Al diagnosticarlo se comprobó que el sistema NO corrompe
 * nada: el único texto dañado venía de un `curl` lanzado desde una terminal de
 * Windows que no enviaba UTF-8. Esta prueba fija ese comportamiento correcto.)
 *
 * Requiere: docker compose up -d (API en :4000 con la BD sembrada).
 */

const BASE = process.env.E2E_API_URL ?? 'http://localhost:4000/api';
const PASS_SEED = 'Prexi123*';

/** Todo lo que un enunciado en español puede llevar y suele romperse. */
const TEXTO_ESPANOL = '¿Cuál es el resultado? áéíóú ÁÉÍÓÚ ñÑ ¡Hola! üÜ «comillas» —guion— 30° · ½';

async function req(metodo: string, ruta: string, opts: { token?: string; body?: unknown } = {}) {
  const res = await fetch(`${BASE}${ruta}`, {
    method: metodo,
    headers: {
      ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const t = await res.text();
  let data: Record<string, unknown>;
  try { data = JSON.parse(t); } catch { data = { _texto: t }; }
  return { status: res.status, data, headers: res.headers };
}

const stamp = Date.now();
let docenteTk = '';
let unidadId = -1;
let temaId = -1;
const ejerciciosCreados: number[] = [];
const retosCreados: number[] = [];

beforeAll(async () => {
  const salud = await req('GET', '/health').catch(() => null);
  if (salud?.status !== 200) throw new Error(`La API no responde en ${BASE}. Levanta el stack: docker compose up -d`);
  const login = await req('POST', '/auth/login', { body: { email: 'docente@upea.edu.bo', password: PASS_SEED } });
  if (login.status !== 201 && login.status !== 200) throw new Error(`login docente → ${login.status}`);
  docenteTk = login.data.token as string;
});

afterAll(async () => {
  // Lo creado se borra explícitamente: al eliminar el tema, sus ejercicios NO
  // caen en cascada (se quedan con `temaId` nulo) y ensuciarían la auditoría.
  for (const id of ejerciciosCreados) await req('DELETE', `/docente/ejercicios/${id}`, { token: docenteTk });
  for (const id of retosCreados) await req('DELETE', `/docente/retos/${id}`, { token: docenteTk });
  if (temaId > 0) await req('DELETE', `/docente/unidades/temas/${temaId}`, { token: docenteTk });
  if (unidadId > 0) await req('DELETE', `/docente/unidades/${unidadId}`, { token: docenteTk });
});

describe('1 · Contenido MÁS ALLÁ de la quinta unidad', () => {
  it('el docente crea una unidad con número alto', async () => {
    // 900+ para no chocar con el plan real ni con otras corridas.
    const r = await req('POST', '/docente/unidades', {
      token: docenteTk,
      body: { numero: 900 + (stamp % 90), titulo: `Unidad E2E contenido ${stamp}`, xp: 30, orden: 900 },
    });
    expect(r.status).toBe(201);
    unidadId = (r.data.unidad as { id: number }).id;
  });

  it('crea un tema dentro de esa unidad', async () => {
    const r = await req('POST', `/docente/unidades/${unidadId}/temas`, {
      token: docenteTk,
      body: { numero: `${900 + (stamp % 90)}.1`, titulo: 'Tema E2E de contenido', umbral: 3 },
    });
    expect(r.status).toBe(201);
    temaId = (r.data.tema as { id: number }).id;
  });

  it('crea un EJERCICIO sin enviar el campo `nivel` (el modelo viejo ya no existe)', async () => {
    const r = await req('POST', '/docente/ejercicios', {
      token: docenteTk,
      body: {
        titulo: 'Ejercicio E2E', categoria: 'Variables', temaId, estrellas: 2,
        tipo: 'opcion_multiple', enunciado: 'Enunciado del ejercicio de prueba end to end',
        opciones: [{ id: 'A', texto: 'a' }, { id: 'B', texto: 'b' }, { id: 'C', texto: 'c' }, { id: 'D', texto: 'd' }],
        respuestaCorrecta: 'A', xp: 20,
      },
    });
    expect(r.status).toBe(201);
    ejerciciosCreados.push((r.data.ejercicio as { id: number }).id);
  });

  it('RECHAZA el ejercicio si el formulario envía `nivel` de más', async () => {
    // Esta es la mitad del contrato que se rompió al retirar el campo del DTO
    // sin quitarlo del formulario: `forbidNonWhitelisted` lo rechaza.
    const r = await req('POST', '/docente/ejercicios', {
      token: docenteTk,
      body: {
        titulo: 'Ejercicio con campo de más', categoria: 'Variables', temaId, estrellas: 2,
        nivel: 1,
        tipo: 'opcion_multiple', enunciado: 'Este no deberia crearse porque manda nivel',
        opciones: [{ id: 'A', texto: 'a' }, { id: 'B', texto: 'b' }, { id: 'C', texto: 'c' }, { id: 'D', texto: 'd' }],
        respuestaCorrecta: 'A', xp: 20,
      },
    });
    expect(r.status).toBe(400);
    expect(JSON.stringify(r.data)).toMatch(/nivel/);
  });

  it('EDITA el ejercicio recién creado', async () => {
    const id = ejerciciosCreados[0];
    const r = await req('PUT', `/docente/ejercicios/${id}`, {
      token: docenteTk, body: { titulo: 'Ejercicio E2E editado', estrellas: 3 },
    });
    expect(r.status).toBe(200);
    expect((r.data.ejercicio as { titulo: string }).titulo).toBe('Ejercicio E2E editado');
  });

  it('crea un RETO sin enviar `nivel`', async () => {
    const r = await req('POST', '/docente/retos', {
      token: docenteTk,
      body: {
        titulo: 'Reto E2E', categoria: 'Variables', temaId, estrellas: 3,
        enunciado: 'Escribe un programa que sume dos numeros enteros', xp: 40,
      },
    });
    expect(r.status).toBe(201);
    const id = (r.data.reto as { id: number } | undefined)?.id ?? (r.data as { id: number }).id;
    expect(typeof id).toBe('number');
    retosCreados.push(id);
  });
});

describe('2 · Integridad del texto en español (acentos, eñes y signos de apertura)', () => {
  let idAcentos = -1;

  it('guarda un enunciado con acentos y lo devuelve IDÉNTICO', async () => {
    const crear = await req('POST', '/docente/ejercicios', {
      token: docenteTk,
      body: {
        titulo: 'Prueba de acentos E2E', categoria: 'Variables', temaId, estrellas: 1,
        tipo: 'opcion_multiple', enunciado: TEXTO_ESPANOL,
        opciones: [{ id: 'A', texto: 'á' }, { id: 'B', texto: 'ñ' }, { id: 'C', texto: 'ü' }, { id: 'D', texto: '¿?' }],
        respuestaCorrecta: 'A', xp: 20,
      },
    });
    expect(crear.status).toBe(201);
    idAcentos = (crear.data.ejercicio as { id: number }).id;
    ejerciciosCreados.push(idAcentos);

    // Se RELEE desde el listado: probar solo la respuesta del POST no
    // demostraría que el texto sobrevivió al viaje de ida y vuelta a Postgres.
    const lista = await req('GET', '/docente/ejercicios?banco=practica', { token: docenteTk });
    expect(lista.status).toBe(200);
    const traido = (lista.data.ejercicios as { id: number; enunciado: string }[]).find((e) => e.id === idAcentos);
    expect(traido).toBeTruthy();
    expect(traido!.enunciado).toBe(TEXTO_ESPANOL);
  });

  it('el texto guardado no contiene NINGÚN carácter de reemplazo (U+FFFD)', async () => {
    const lista = await req('GET', '/docente/ejercicios?banco=practica', { token: docenteTk });
    const traido = (lista.data.ejercicios as { id: number; enunciado: string }[]).find((e) => e.id === idAcentos);
    expect(traido!.enunciado).not.toMatch(/�/);
  });

  it('la respuesta declara charset UTF-8', async () => {
    const lista = await req('GET', '/docente/ejercicios?banco=practica', { token: docenteTk });
    expect(String(lista.headers.get('content-type'))).toMatch(/charset=utf-8/i);
  });
});
