/**
 * AUDITORÍA COMPLETA DEL SISTEMA — gating estricto por nivel-por-tema +
 * integridad del banco de Ejercicios y Retos.
 *
 *   npx tsx scripts/auditoria-completa.ts
 *
 * Corre contra la BASE DE DATOS REAL (no fixtures) vía Prisma para las Reglas
 * 1-9, y contra la API REAL corriendo (docker compose up -d) para la Regla 10,
 * que exige el flujo HTTP genuino de subida de nivel (no existe forma de fijar
 * a mano el nivel de un estudiante: hay que pasar por el mini-diagnóstico real).
 *
 * Variables de entorno:
 *   DATABASE_URL   → debe apuntar a la BD real (mismo .env del backend).
 *   E2E_API_URL    → por defecto http://localhost:4000/api (requiere la API arriba).
 *
 * La Regla 10 crea UN estudiante desechable (email con timestamp) y lo borra al
 * final (prisma.usuario.delete → cascada). No modifica ningún ejercicio/reto
 * existente. No toca el examen de fin de unidad (por diseño, mezcla niveles).
 *
 * Reporta cada regla como PASS/FAIL con el detalle de cada fallo. Sale con
 * código 1 si alguna regla falla.
 */
import { PrismaClient, Banco, NivelDificultad, TipoEjercicio } from '@prisma/client';
import { distribucionClave } from '../src/common/banco/clave-equilibrada';

const prisma = new PrismaClient();
const API = process.env.E2E_API_URL ?? 'http://localhost:4000/api';
const PASS_SEED = 'Prexi123*';
const ESPERADO: Record<NivelDificultad, number> = { basico: 15, intermedio: 10, avanzado: 5 };
const TIPOS_CON_OPCIONES: TipoEjercicio[] = ['opcion_multiple', 'predecir_salida'];

interface Resultado { regla: string; ok: boolean; detalle: string[] }
const resultados: Resultado[] = [];

function reportar(regla: string, fallos: string[]) {
  resultados.push({ regla, ok: fallos.length === 0, detalle: fallos });
}

async function req(method: string, path: string, opts: { token?: string; body?: unknown } = {}) {
  const res = await fetch(`${API}${path}`, {
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

async function login(email: string, password = PASS_SEED) {
  const r = await req('POST', '/auth/login', { body: { email, password } });
  if (r.status !== 200 && r.status !== 201) throw new Error(`login ${email} → ${r.status}: ${JSON.stringify(r.data)}`);
  return r.data.token as string;
}

/* ─────────────────────── Reglas 1 y 2: distribución 15/10/5 por tema (U1 y U2) ─────────────────────── */

async function reglaDistribucion(numeroUnidad: number, nombreRegla: string) {
  const fallos: string[] = [];
  const unidad = await prisma.unidad.findFirst({ where: { numero: numeroUnidad } });
  if (!unidad) { fallos.push(`No existe la Unidad ${numeroUnidad}.`); reportar(nombreRegla, fallos); return; }

  const temas = await prisma.tema.findMany({
    where: { unidadId: unidad.id, publicado: true },
    orderBy: [{ orden: 'asc' }, { numero: 'asc' }],
    select: { id: true, numero: true, titulo: true },
  });
  const ejercicios = await prisma.ejercicio.findMany({
    where: { temaId: { in: temas.map((t) => t.id) }, activo: true, banco: Banco.practica },
    select: { temaId: true, nivelDificultad: true, fuenteDoc: true },
  });

  for (const t of temas) {
    const delTema = ejercicios.filter((e) => e.temaId === t.id);
    // Los temas preexistentes (contenido conservado al re-sembrar) no se exigen
    // a la distribución 15/10/5 del banco oficial.
    const preexistente = delTema.length > 0
      && delTema.every((e) => ((e.fuenteDoc ?? {}) as { origen?: string }).origen === 'preexistente');
    if (preexistente) continue;
    for (const nivel of Object.keys(ESPERADO) as NivelDificultad[]) {
      const n = delTema.filter((e) => e.nivelDificultad === nivel).length;
      if (n !== ESPERADO[nivel]) {
        fallos.push(`Tema ${t.numero} (${t.titulo}) · nivel ${nivel}: ${n} ejercicios (esperado ${ESPERADO[nivel]}).`);
      }
    }
  }
  reportar(nombreRegla, fallos);
}

/* ─────────────────────── Regla 3: sin código de ejercicio duplicado (todas las unidades) ─────────────────────── */

async function regla3CodigosDuplicados() {
  const fallos: string[] = [];
  const ejercicios = await prisma.ejercicio.findMany({ select: { id: true, fuenteDoc: true } });
  const vistos = new Map<string, number>();
  for (const e of ejercicios) {
    const codigo = ((e.fuenteDoc ?? {}) as { codigo?: string }).codigo;
    if (!codigo) continue;
    const previo = vistos.get(codigo);
    if (previo != null) fallos.push(`Código "${codigo}" duplicado (ejercicios id ${previo} y ${e.id}).`);
    else vistos.set(codigo, e.id);
  }
  reportar('3. Sin códigos de ejercicio duplicados', fallos);
}

/* ─────────────────────── Regla 4: opcion_multiple/predecir_salida con exactamente 4 opciones ─────────────────────── */

async function regla4Opciones() {
  const fallos: string[] = [];
  const ejercicios = await prisma.ejercicio.findMany({
    where: { tipo: { in: TIPOS_CON_OPCIONES } },
    select: { id: true, tipo: true, opciones: true, fuenteDoc: true },
  });
  for (const e of ejercicios) {
    const codigo = ((e.fuenteDoc ?? {}) as { codigo?: string }).codigo ?? `id ${e.id}`;
    const opciones = Array.isArray(e.opciones) ? (e.opciones as unknown[]) : [];
    if (opciones.length !== 4) fallos.push(`Ejercicio ${codigo} (${e.tipo}): ${opciones.length} opciones (esperado 4).`);
  }
  reportar('4. opcion_multiple/predecir_salida con 4 opciones', fallos);
}

/* ─────────────────────── Regla 5: examen final = 10 (5 intermedio + 5 avanzado), sin solapar con la práctica ─────────────────────── */

async function regla5Examen(numeroUnidad: number, nombreRegla: string) {
  const fallos: string[] = [];
  const unidad = await prisma.unidad.findFirst({ where: { numero: numeroUnidad } });
  if (!unidad) { fallos.push(`No existe la Unidad ${numeroUnidad}.`); reportar(nombreRegla, fallos); return; }

  const temas = await prisma.tema.findMany({ where: { unidadId: unidad.id }, select: { id: true } });
  const temaIds = temas.map((t) => t.id);

  const examen = await prisma.ejercicio.findMany({
    where: { banco: Banco.examen, temaId: { in: temaIds } },
    select: { id: true, nivelDificultad: true, fuenteDoc: true },
  });
  const practica = await prisma.ejercicio.findMany({
    where: { banco: Banco.practica, temaId: { in: temaIds } },
    select: { fuenteDoc: true },
  });

  const exInt = examen.filter((e) => e.nivelDificultad === 'intermedio').length;
  const exAvz = examen.filter((e) => e.nivelDificultad === 'avanzado').length;
  const exBas = examen.filter((e) => e.nivelDificultad === 'basico').length;

  if (examen.length !== 10) fallos.push(`El examen de la Unidad ${numeroUnidad} tiene ${examen.length} ítems (esperado 10).`);
  if (exInt !== 5) fallos.push(`El examen tiene ${exInt} ítems intermedios (esperado 5).`);
  if (exAvz !== 5) fallos.push(`El examen tiene ${exAvz} ítems avanzados (esperado 5).`);
  if (exBas !== 0) fallos.push(`El examen tiene ${exBas} ítems básicos (esperado 0).`);

  const codigosPractica = new Set(
    practica.map((e) => ((e.fuenteDoc ?? {}) as { codigo?: string }).codigo).filter(Boolean) as string[],
  );
  for (const e of examen) {
    const codigo = ((e.fuenteDoc ?? {}) as { codigo?: string }).codigo;
    if (codigo && codigosPractica.has(codigo)) {
      fallos.push(`El código de examen "${codigo}" también aparece en el banco de práctica (no debe repetirse).`);
    }
  }
  reportar(nombreRegla, fallos);
}

/* ─────────────────────── Regla 6: todo Reto activo referencia un Ejercicio existente y activo ─────────────────────── */

async function regla6RetosOrigen() {
  const fallos: string[] = [];
  const retos = await prisma.reto.findMany({
    where: { activo: true },
    select: { id: true, codigo: true, origenEjercicioId: true, origenEjercicio: { select: { id: true, activo: true } } },
  });
  for (const r of retos) {
    const ref = r.codigo ?? `id ${r.id}`;
    if (r.origenEjercicioId == null) {
      fallos.push(`Reto ${ref}: no tiene origenEjercicioId.`);
      continue;
    }
    if (!r.origenEjercicio) fallos.push(`Reto ${ref}: origenEjercicioId ${r.origenEjercicioId} no existe.`);
    else if (!r.origenEjercicio.activo) fallos.push(`Reto ${ref}: el ejercicio origen (id ${r.origenEjercicioId}) está inactivo.`);
  }
  reportar('6. Todo Reto activo referencia un Ejercicio existente y activo', fallos);
}

/* ─────────────────────── Regla 7: retos de depuración (bug-hunt) requieren codigoPython no nulo en el origen ─────────────────────── */

async function regla7Depuracion() {
  const fallos: string[] = [];
  const retos = await prisma.reto.findMany({
    where: { activo: true, esBugHunt: true },
    select: { id: true, codigo: true, origenEjercicio: { select: { id: true, codigoPython: true } } },
  });
  for (const r of retos) {
    const ref = r.codigo ?? `id ${r.id}`;
    if (!r.origenEjercicio?.codigoPython) {
      fallos.push(`Reto de depuración ${ref}: el ejercicio origen no tiene codigoPython (no se puede plantar/validar el bug).`);
    }
  }
  reportar('7. Retos de depuración originan de un Ejercicio con codigoPython', fallos);
}

/* ─────────────────────── Regla 8: Reto.nivelDificultad == origen.nivelDificultad ─────────────────────── */

async function regla8NivelCoincide() {
  const fallos: string[] = [];
  const retos = await prisma.reto.findMany({
    where: { activo: true, origenEjercicioId: { not: null } },
    select: { id: true, codigo: true, nivelDificultad: true, origenEjercicio: { select: { nivelDificultad: true } } },
  });
  for (const r of retos) {
    const ref = r.codigo ?? `id ${r.id}`;
    if (r.origenEjercicio && r.nivelDificultad !== r.origenEjercicio.nivelDificultad) {
      fallos.push(`Reto ${ref}: nivelDificultad=${r.nivelDificultad} pero el ejercicio origen es ${r.origenEjercicio.nivelDificultad}.`);
    }
  }
  reportar('8. Reto.nivelDificultad coincide con el del Ejercicio origen', fallos);
}

/* ─────────────────────── Regla 9: sin código de Reto duplicado ─────────────────────── */

async function regla9CodigoRetoDuplicado() {
  const fallos: string[] = [];
  const retos = await prisma.reto.findMany({ where: { codigo: { not: null } }, select: { id: true, codigo: true } });
  const vistos = new Map<string, number>();
  for (const r of retos) {
    const codigo = r.codigo!;
    const previo = vistos.get(codigo);
    if (previo != null) fallos.push(`Código de reto "${codigo}" duplicado (retos id ${previo} y ${r.id}).`);
    else vistos.set(codigo, r.id);
  }
  reportar('9. Sin códigos de Reto duplicados', fallos);
}

/* ─────────────────────── Regla 10: gating estricto por (temaCodigo, nivelDelEstudianteEnEseTema) ─────────────────────── */
//
// No existe endpoint de docente para fijar el nivel a mano: se sube de nivel
// pasando por el mini-diagnóstico real (GET+POST /ejercicios/subir-nivel), igual
// que lo haría un estudiante real. El script lee la respuesta correcta real de la
// BD (el estudiante de prueba nunca la ve por la API) solo para poder aprobar el
// mini-diagnóstico de forma legítima.

async function regla10Gating() {
  const fallos: string[] = [];
  const stamp = Date.now();
  let usuarioId: number | null = null;

  try {
    const unidad2 = await prisma.unidad.findFirst({ where: { numero: 2 } });
    if (!unidad2) { fallos.push('No existe la Unidad 2 (requerida para esta prueba: temas 2.3 y 2.4).'); reportar('10. Gating estricto por tema (E2E)', fallos); return; }

    const tema23 = await prisma.tema.findFirst({ where: { unidadId: unidad2.id, numero: '2.3' } });
    const tema24 = await prisma.tema.findFirst({ where: { unidadId: unidad2.id, numero: '2.4' } });
    if (!tema23 || !tema24) { fallos.push('No se encontraron los temas 2.3 y/o 2.4.'); reportar('10. Gating estricto por tema (E2E)', fallos); return; }

    // 1) Registra un estudiante de prueba desechable y entra al sistema.
    const email = `auditoria.gating.${stamp}@test.bo`;
    const reg = await req('POST', '/auth/register', {
      body: { nombre: `Auditoria Gating ${stamp}`, email, password: PASS_SEED, cedula: `AUD${stamp}`.slice(-9), carrera: 'Sistemas', paralelo: `AUD${stamp % 1000}` },
    });
    if (reg.status !== 201) { fallos.push(`No se pudo registrar el estudiante de prueba: ${reg.status} ${JSON.stringify(reg.data)}`); reportar('10. Gating estricto por tema (E2E)', fallos); return; }
    usuarioId = reg.data.usuario?.id ?? reg.data.id ?? null;
    const token = await login(email);

    // 2) Estado inicial: sin ProgresoTema, ambos temas deben partir en básico.
    const ruta23_inicial = await req('GET', `/ejercicios/ruta?tema=${tema23.id}`, { token });
    const ruta24_inicial = await req('GET', `/ejercicios/ruta?tema=${tema24.id}`, { token });
    verificarSoloNivel(ruta23_inicial.data?.ejercicios ?? [], 'basico', '2.3 (estado inicial, /ejercicios/ruta)', fallos);
    verificarSoloNivel(ruta24_inicial.data?.ejercicios ?? [], 'basico', '2.4 (estado inicial, /ejercicios/ruta)', fallos);

    const retos23_inicial = await req('GET', `/retos?tema=2.3`, { token });
    const retos24_inicial = await req('GET', `/retos?tema=2.4`, { token });
    verificarSoloNivelReto(retos23_inicial.data?.retos ?? [], 'basico', '2.3 (estado inicial, /retos)', fallos);
    verificarSoloNivelReto(retos24_inicial.data?.retos ?? [], 'basico', '2.4 (estado inicial, /retos)', fallos);

    // 3) Sube de nivel en 2.3 (básico → intermedio) por el mini-diagnóstico REAL.
    const subida = await subirDeNivel(token, tema23.id);
    if (!subida.aprobado) {
      fallos.push(`No se pudo subir de nivel en el tema 2.3 con el mini-diagnóstico real: ${subida.motivo}`);
    } else {
      // 4) Tras subir: 2.3 debe mostrar SOLO intermedio (nada de básico) y 2.4 debe seguir en básico.
      const ruta23_post = await req('GET', `/ejercicios/ruta?tema=${tema23.id}`, { token });
      const ruta24_post = await req('GET', `/ejercicios/ruta?tema=${tema24.id}`, { token });
      verificarSoloNivel(ruta23_post.data?.ejercicios ?? [], 'intermedio', '2.3 (tras subir de nivel, /ejercicios/ruta)', fallos);
      verificarSoloNivel(ruta24_post.data?.ejercicios ?? [], 'basico', '2.4 (sin cambios, /ejercicios/ruta)', fallos);

      const retos23_post = await req('GET', `/retos?tema=2.3`, { token });
      const retos24_post = await req('GET', `/retos?tema=2.4`, { token });
      verificarSoloNivelReto(retos23_post.data?.retos ?? [], 'intermedio', '2.3 (tras subir de nivel, /retos)', fallos);
      verificarSoloNivelReto(retos24_post.data?.retos ?? [], 'basico', '2.4 (sin cambios, /retos)', fallos);
    }
  } catch (e) {
    fallos.push(`Error inesperado ejecutando la Regla 10: ${(e as Error).message}`);
  } finally {
    if (usuarioId != null) await prisma.usuario.delete({ where: { id: usuarioId } }).catch(() => {});
  }

  reportar('10. Gating estricto por (temaCodigo, nivel) — /ejercicios/ruta y /retos', fallos);
}

function verificarSoloNivel(ejercicios: { nivelDificultad?: string; nivel_dificultad?: string }[], nivelEsperado: string, etiqueta: string, fallos: string[]) {
  const distintos = ejercicios.filter((e) => (e.nivelDificultad ?? e.nivel_dificultad) !== nivelEsperado);
  if (distintos.length > 0) {
    fallos.push(`Tema ${etiqueta}: ${distintos.length} ejercicio(s) de un nivel distinto a "${nivelEsperado}" son visibles (debería verse SOLO ${nivelEsperado}).`);
  }
}

function verificarSoloNivelReto(retos: { nivel_dificultad?: string }[], nivelEsperado: string, etiqueta: string, fallos: string[]) {
  const distintos = retos.filter((r) => r.nivel_dificultad !== nivelEsperado);
  if (distintos.length > 0) {
    fallos.push(`Reto ${etiqueta}: ${distintos.length} reto(s) de un nivel distinto a "${nivelEsperado}" son visibles (debería verse SOLO ${nivelEsperado}).`);
  }
}

/** Sube de nivel usando el flujo real (mini-diagnóstico), leyendo la respuesta
 *  correcta directamente de la BD solo para poder aprobarlo legítimamente. */
async function subirDeNivel(token: string, temaId: number): Promise<{ aprobado: boolean; motivo?: string }> {
  const inicio = await req('GET', `/ejercicios/subir-nivel?tema=${temaId}`, { token });
  if (inicio.status !== 200) return { aprobado: false, motivo: `GET subir-nivel → ${inicio.status}: ${JSON.stringify(inicio.data)}` };
  const preguntas: { id: number }[] = inicio.data.preguntas ?? [];
  if (preguntas.length === 0) return { aprobado: false, motivo: 'El mini-diagnóstico no devolvió preguntas.' };

  const reales = await prisma.ejercicio.findMany({
    where: { id: { in: preguntas.map((p) => p.id) } },
    select: { id: true, tipo: true, respuestaCorrecta: true },
  });
  const respuestas = reales.map((e) => ({ ejercicioId: e.id, respuesta: e.respuestaCorrecta.split('|')[0] }));

  const evaluar = await req('POST', '/ejercicios/subir-nivel', { token, body: { temaId, respuestas } });
  if (evaluar.status !== 200 && evaluar.status !== 201) return { aprobado: false, motivo: `POST subir-nivel → ${evaluar.status}: ${JSON.stringify(evaluar.data)}` };
  return { aprobado: !!evaluar.data.aprobado, motivo: evaluar.data.aprobado ? undefined : `puntaje ${evaluar.data.puntaje}/${evaluar.data.umbral ?? '?'}` };
}

/* ───────────── Regla 11: la clave de respuestas no puede concentrarse en una posición ───────────── */

/**
 * Umbral de concentración de la clave. Si más del 35 % de las respuestas
 * correctas de un banco cae en la misma posición, el banco deja de medir
 * conocimiento: un estudiante que marque siempre esa letra obtiene una
 * puntuación alta sin dominar el contenido, y esa puntuación contamina θ (IRT),
 * el nivel adaptativo asignado y la comparación pre/post. Es un defecto de
 * INSTRUMENTO y por eso la auditoría falla, no advierte.
 * El reparto lo produce src/common/banco/clave-equilibrada (≈25 % por posición);
 * este 35 % deja margen a bancos pequeños sin tolerar un sesgo real.
 */
const MAX_CONCENTRACION_CLAVE = 0.35;
/** Bancos con menos ítems que esto no son evaluables estadísticamente. */
const MIN_ITEMS_CLAVE = 12;

async function regla11Clave() {
  const fallos: string[] = [];
  const ejercicios = await prisma.ejercicio.findMany({
    where: { tipo: { in: TIPOS_CON_OPCIONES } },
    select: { id: true, banco: true, temaId: true, respuestaCorrecta: true, opciones: true },
  });
  // Solo items de 4 opciones: el numero de opciones lo gobierna la Regla 4, y
  // mezclar items de 2 y de 4 haria imposible fijar un umbral con sentido.
  const deCuatro = ejercicios.filter((e) => Array.isArray(e.opciones) && (e.opciones as unknown[]).length === 4);
  const temas = await prisma.tema.findMany({ select: { id: true, unidadId: true } });
  const unidades = await prisma.unidad.findMany({ select: { id: true, numero: true } });
  const numeroUnidad = new Map(unidades.map((u) => [u.id, u.numero]));
  const unidadDeTema = new Map(temas.map((t) => [t.id, t.unidadId]));

  // Se audita por banco y, dentro del banco, por unidad: un sesgo concentrado en
  // una sola unidad quedaría diluido si solo se mirara el total del sistema.
  const grupos = new Map<string, string[]>();
  const agregar = (clave: string, letra: string) => {
    const g = grupos.get(clave);
    if (g) g.push(letra);
    else grupos.set(clave, [letra]);
  };
  for (const e of deCuatro) {
    const u = e.temaId != null ? numeroUnidad.get(unidadDeTema.get(e.temaId) ?? -1) : undefined;
    agregar(`banco ${e.banco}`, e.respuestaCorrecta);
    if (u != null) agregar(`banco ${e.banco} · Unidad ${u}`, e.respuestaCorrecta);
  }

  for (const [nombre, letras] of [...grupos.entries()].sort()) {
    if (letras.length < MIN_ITEMS_CLAVE) continue;
    const conteo = distribucionClave(letras);
    for (const [letra, n] of Object.entries(conteo).sort()) {
      const pct = n / letras.length;
      if (pct > MAX_CONCENTRACION_CLAVE) {
        const detalle = Object.entries(conteo)
          .sort()
          .map(([l, c]) => `${l}:${Math.round((c / letras.length) * 100)}%`)
          .join(' ');
        fallos.push(
          `${nombre} (n=${letras.length}): la clave "${letra}" concentra el ${Math.round(pct * 100)}% ` +
            `(máximo permitido ${Math.round(MAX_CONCENTRACION_CLAVE * 100)}%). Distribución: ${detalle}. ` +
            `Corrige con: npx tsx scripts/equilibrar-clave-bd.ts --aplicar`,
        );
      }
    }
  }
  reportar(`11. Clave de respuestas repartida (ninguna posición > ${Math.round(MAX_CONCENTRACION_CLAVE * 100)}% por banco)`, fallos);
}

/* ─────────────────────── Main ─────────────────────── */

async function main() {
  console.log(`\n══ AUDITORÍA COMPLETA · ${new Date().toISOString()} ══\n`);

  await reglaDistribucion(1, '1. Distribución 15/10/5 por tema — Unidad 1');
  await reglaDistribucion(2, '2. Distribución 15/10/5 por tema — Unidad 2');
  await regla3CodigosDuplicados();
  await regla4Opciones();
  await regla5Examen(1, '5. Examen final Unidad 1: 10 ítems (5 int + 5 avz), sin solape con práctica');
  await regla5Examen(2, '5. Examen final Unidad 2: 10 ítems (5 int + 5 avz), sin solape con práctica');
  await regla6RetosOrigen();
  await regla7Depuracion();
  await regla8NivelCoincide();
  await regla9CodigoRetoDuplicado();
  await regla10Gating();
  await regla11Clave();

  console.log('Regla                                                                              Resultado');
  console.log('─'.repeat(100));
  let algunaFallo = false;
  for (const r of resultados) {
    console.log(`${r.regla.padEnd(84)}  ${r.ok ? '✔ PASS' : '✖ FAIL'}`);
    if (!r.ok) {
      algunaFallo = true;
      for (const d of r.detalle) console.log(`    - ${d}`);
    }
  }
  console.log('─'.repeat(100));
  console.log(algunaFallo ? `\n✖ Auditoría con fallos (${resultados.filter((r) => !r.ok).length}/${resultados.length} reglas en FAIL).\n` : `\n✔ Auditoría completa: ${resultados.length}/${resultados.length} reglas en PASS.\n`);

  await prisma.$disconnect();
  process.exit(algunaFallo ? 1 : 0);
}

main().catch(async (e) => {
  console.error('✖ Falló la auditoría con un error no controlado:', e);
  await prisma.$disconnect();
  process.exit(1);
});
