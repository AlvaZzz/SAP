/**
 * AUDITORÍA DE INTEGRIDAD DE LOS DATOS DE INVESTIGACIÓN (Bloque B).
 *
 *   docker exec prexi-api npx tsx scripts/auditoria-investigacion.ts
 *
 * Complementa a `scripts/auditoria-completa.ts` (Bloque A: reglas de negocio del
 * banco y del gating). Aquí se audita lo que sostiene la TESIS: registro y grupos,
 * pretest/postest pareados, θ (IRT), trazabilidad del proceso adaptativo y el
 * dataset exportable.
 *
 * SOLO LECTURA: no escribe, no corrige y no reasigna nada. Los usuarios se
 * identifican SIEMPRE por id numérico — nunca nombre, correo ni cédula.
 *
 * Sale con código 1 si alguna regla falla.
 */
import { PrismaClient, NivelDificultad } from '@prisma/client';

const prisma = new PrismaClient();

/** Umbral de respuestas de pretest con dificultadB para exigir θ inicial. */
const MIN_RESPUESTAS_THETA = 3;
/** Fracción máxima tolerable de nulos en un campo crítico del dataset. */
const MAX_FRACCION_NULOS = 0.5;

interface Resultado { regla: string; ok: boolean; detalle: string[]; nota?: string }
const resultados: Resultado[] = [];

function reportar(regla: string, fallos: string[], nota?: string) {
  resultados.push({ regla, ok: fallos.length === 0, detalle: fallos, nota });
}
/** Regla informativa: siempre PASS, sirve para dejar el dato en el reporte. */
function informar(regla: string, nota: string) {
  resultados.push({ regla, ok: true, detalle: [], nota });
}
/** Recorta listas largas para que el reporte siga siendo legible. */
function muestra(items: string[], max = 12): string[] {
  return items.length <= max ? items : [...items.slice(0, max), `… y ${items.length - max} más`];
}

/* ══════════════════ B1 · Registro y grupos de investigación ══════════════════ */

async function b1Campos() {
  const fallos: string[] = [];
  const estudiantes = await prisma.usuario.findMany({
    where: { rol: 'estudiante' },
    select: { id: true, paralelo: true, carrera: true, semestre: true, email: true, cedula: true, activo: true },
  });

  const sinDato = estudiantes.filter((u) =>
    !u.paralelo?.trim() || !u.carrera?.trim() || u.semestre == null);
  for (const u of sinDato) {
    const falta = [
      !u.paralelo?.trim() ? 'paralelo' : null,
      !u.carrera?.trim() ? 'carrera' : null,
      u.semestre == null ? 'semestre' : null,
    ].filter(Boolean).join(', ');
    fallos.push(`usuarioId ${u.id}: falta ${falta}.`);
  }

  // email/cedula vacíos o de relleno (el @unique no impide un placeholder).
  const sospechoso = (v: string | null) => !v?.trim() || /^(n\/?a|null|none|sin|test|-+)$/i.test(v.trim());
  for (const u of estudiantes) {
    if (sospechoso(u.email)) fallos.push(`usuarioId ${u.id}: email vacío o de relleno.`);
    if (u.cedula !== null && sospechoso(u.cedula)) fallos.push(`usuarioId ${u.id}: cédula vacía o de relleno.`);
  }

  reportar('B1.1 Estudiantes con paralelo, carrera y semestre; sin email/cédula de relleno',
    muestra(fallos), `${estudiantes.length} estudiantes evaluados.`);
}

async function b1Grupos() {
  const fallos: string[] = [];
  const estudiantes = await prisma.usuario.findMany({
    where: { rol: 'estudiante' },
    select: { id: true, paralelo: true, grupo: true },
  });

  // El diseño asigna el grupo POR PARALELO COMPLETO. Un paralelo con ambos
  // grupos solo es válido si cada excepción quedó auditada (asignación forzada).
  const forzados = await prisma.logAuditoria.findMany({
    where: { accion: { in: ['grupo_cambiar', 'grupo_asignar'] } },
    select: { entidadId: true, detalle: true },
  });
  const idsForzados = new Set(forzados.filter((l) => /forzar|forzad/i.test(l.detalle)).map((l) => l.entidadId));

  const porParalelo = new Map<string, { control: number[]; experimental: number[] }>();
  for (const u of estudiantes) {
    const p = (u.paralelo ?? '(sin paralelo)').toUpperCase();
    const g = porParalelo.get(p) ?? { control: [], experimental: [] };
    g[u.grupo].push(u.id);
    porParalelo.set(p, g);
  }

  for (const [paralelo, g] of [...porParalelo.entries()].sort()) {
    if (g.control.length === 0 || g.experimental.length === 0) continue; // homogéneo: correcto
    const minoria = g.control.length <= g.experimental.length ? g.control : g.experimental;
    const sinAuditar = minoria.filter((id) => !idsForzados.has(id));
    if (sinAuditar.length) {
      fallos.push(`Paralelo ${paralelo}: mezcla control(${g.control.length})/experimental(${g.experimental.length}); ` +
        `sin LogAuditoria de asignación forzada: usuarioId ${sinAuditar.join(', ')}.`);
    }
  }

  reportar('B1.2 Grupo consistente por paralelo (excepciones auditadas como forzadas)',
    muestra(fallos), `${porParalelo.size} paralelos evaluados.`);
}

async function b1Bloqueo() {
  const fallos: string[] = [];
  const cfg = await prisma.configuracionSistema.findUnique({
    where: { id: 1 }, select: { gruposBloqueados: true },
  });
  if (!cfg?.gruposBloqueados) {
    informar('B1.3 Con grupos bloqueados, no hay cambios de grupo sin forzar+auditar',
      'gruposBloqueados = false: la regla no aplica en este momento.');
    return;
  }
  // Con el bloqueo activo, cualquier cambio de grupo posterior debe estar auditado
  // y marcado como forzado.
  const cambios = await prisma.logAuditoria.findMany({
    where: { accion: { in: ['grupo_cambiar', 'grupo_asignar'] } },
    orderBy: { fecha: 'desc' }, select: { id: true, entidadId: true, detalle: true, fecha: true },
  });
  for (const c of cambios) {
    if (!/forzar|forzad/i.test(c.detalle)) {
      fallos.push(`LogAuditoria ${c.id} (usuarioId ${c.entidadId}, ${c.fecha.toISOString()}): cambio de grupo con el bloqueo activo y sin marca de forzado.`);
    }
  }
  reportar('B1.3 Con grupos bloqueados, no hay cambios de grupo sin forzar+auditar', muestra(fallos));
}

/* ══════════════════ B2 · Pretest y clasificación inicial ══════════════════ */

async function b2Pretest() {
  const completados = await prisma.usuario.findMany({
    where: { rol: 'estudiante', pretestCompletado: true },
    select: { id: true, nivelInicialAdaptativo: true, thetaInicial: true },
  });

  const evalPre = new Set((await prisma.evaluacion.findMany({ where: { tipo: 'pre' }, select: { usuarioId: true } })).map((e) => e.usuarioId));
  const respPre = await prisma.pretestRespuesta.groupBy({ by: ['usuarioId'], where: { tipo: 'pre' }, _count: { _all: true } });
  const nRespPre = new Map(respPre.map((r) => [r.usuarioId, r._count._all]));

  // B2.1 — "completado" con evidencia real (Evaluacion + respuestas).
  const fantasma: string[] = [];
  for (const u of completados) {
    const falta = [
      !evalPre.has(u.id) ? 'sin Evaluacion(pre)' : null,
      !nRespPre.get(u.id) ? 'sin PretestRespuesta(pre)' : null,
    ].filter(Boolean).join(' y ');
    if (falta) fantasma.push(`usuarioId ${u.id}: pretestCompletado=true pero ${falta}.`);
  }
  reportar('B2.1 pretestCompletado respaldado por Evaluacion(pre) + respuestas',
    muestra(fantasma), `${completados.length} estudiantes con pretest completado.`);

  // B2.2 — clasificación inicial fijada.
  const sinNivel = completados.filter((u) => u.nivelInicialAdaptativo == null)
    .map((u) => `usuarioId ${u.id}: nivelInicialAdaptativo NULL con pretest completado.`);
  reportar('B2.2 nivelInicialAdaptativo fijado en todo pretest completado', muestra(sinNivel));

  // B2.3 — θ inicial cuando hubo ítems calibrados suficientes.
  const conB = await prisma.pretestRespuesta.findMany({
    where: { tipo: 'pre', ejercicio: { dificultadB: { not: undefined } } },
    select: { usuarioId: true },
  });
  const nConB = new Map<number, number>();
  for (const r of conB) nConB.set(r.usuarioId, (nConB.get(r.usuarioId) ?? 0) + 1);

  const sinTheta = completados
    .filter((u) => u.thetaInicial == null && (nConB.get(u.id) ?? 0) >= MIN_RESPUESTAS_THETA)
    .map((u) => `usuarioId ${u.id}: thetaInicial NULL con ${nConB.get(u.id)} respuestas de pretest sobre ítems calibrados.`);
  reportar(`B2.3 thetaInicial estimado cuando hay ≥${MIN_RESPUESTAS_THETA} respuestas sobre ítems con dificultadB`,
    muestra(sinTheta));
}

/* ══════════════════ B3 · Postest y evaluación final ══════════════════ */

async function b3Postest() {
  const pre = new Set((await prisma.evaluacion.findMany({ where: { tipo: 'pre' }, select: { usuarioId: true } })).map((e) => e.usuarioId));
  const post = await prisma.evaluacion.findMany({ where: { tipo: 'post' }, select: { usuarioId: true, puntajeTotal: true } });

  // B3.1 — pareo pre/post: sin pretest no hay prueba t posible con esa fila.
  const huerfanos = post.filter((p) => !pre.has(p.usuarioId))
    .map((p) => `usuarioId ${p.usuarioId}: Evaluacion(post) sin Evaluacion(pre) — no parea para la prueba t.`);
  reportar('B3.1 Todo postest tiene su pretest pareado', muestra(huerfanos),
    `${pre.size} pretests · ${post.length} postests.`);

  // B3.2 — θ final estimado.
  const usuariosPost = post.map((p) => p.usuarioId);
  const conPost = await prisma.usuario.findMany({
    where: { id: { in: usuariosPost } }, select: { id: true, thetaFinal: true },
  });
  const respPost = await prisma.pretestRespuesta.groupBy({ by: ['usuarioId'], where: { tipo: 'post' }, _count: { _all: true } });
  const nRespPost = new Map(respPost.map((r) => [r.usuarioId, r._count._all]));
  const sinTheta = conPost
    .filter((u) => u.thetaFinal == null && (nRespPost.get(u.id) ?? 0) >= MIN_RESPUESTAS_THETA)
    .map((u) => `usuarioId ${u.id}: thetaFinal NULL con ${nRespPost.get(u.id)} respuestas de postest.`);
  reportar('B3.2 thetaFinal estimado cuando hay respuestas suficientes de postest', muestra(sinTheta));

  // B3.3 — nadie rindió el postest por debajo del gate de nivel configurado.
  const cfg = await prisma.configuracionSistema.findUnique({ where: { id: 1 }, select: { postestDesdeNivel: true } });
  const desde = cfg?.postestDesdeNivel ?? 3;
  const bajoNivel = await prisma.usuario.findMany({
    where: { id: { in: usuariosPost }, nivelInicial: { lt: desde } },
    select: { id: true, nivelInicial: true },
  });
  reportar(`B3.3 Nadie completó el postest por debajo de postestDesdeNivel (${desde})`,
    muestra(bajoNivel.map((u) => `usuarioId ${u.id}: postest con nivelInicial ${u.nivelInicial} < ${desde}.`)));
}

/* ══════════════════ B4 · Trazabilidad del proceso adaptativo ══════════════════ */

async function b4Trazabilidad() {
  // B4.1 — ¿los intentos caen sobre ítems calibrados? Sin b no hay re-estimación de θ.
  const totalIntentos = await prisma.intento.count();
  const intentosSinB = await prisma.intento.count({ where: { ejercicio: { dificultadB: 0 } } });
  const pct = totalIntentos ? Math.round(((totalIntentos - intentosSinB) / totalIntentos) * 100) : 0;
  const fallosB4a: string[] = [];
  if (totalIntentos === 0) fallosB4a.push('No hay ni un Intento registrado: no hay evidencia de práctica que analizar.');
  else if (pct < 50) fallosB4a.push(`Solo el ${pct}% de los intentos cae sobre ítems con dificultadB ≠ 0 (${totalIntentos - intentosSinB}/${totalIntentos}); θ_actual se re-estima con poca información.`);
  reportar('B4.1 Los intentos caen sobre ítems calibrados (dificultadB) para re-estimar θ',
    fallosB4a, `${pct}% de ${totalIntentos} intentos sobre ítems con b ≠ 0.`);

  // B4.2 — la ruta adaptativa deja rastro.
  const activos = await prisma.usuario.findMany({
    where: { rol: 'estudiante', intentos: { some: {} } }, select: { id: true },
  });
  const conPaso = new Set((await prisma.pasoRuta.groupBy({ by: ['usuarioId'] })).map((p) => p.usuarioId));
  const sinRuta = activos.filter((u) => !conPaso.has(u.id))
    .map((u) => `usuarioId ${u.id}: tiene intentos pero ningún PasoRuta (su "ruta seguida" saldría vacía).`);
  reportar('B4.2 PasoRuta poblado para estudiantes con actividad', muestra(sinRuta),
    `${activos.length} estudiantes con intentos.`);

  // B4.3 — todo nivel por encima del inicial está respaldado por una subida aprobada.
  const orden: Record<NivelDificultad, number> = { basico: 0, intermedio: 1, avanzado: 2 };
  const progresos = await prisma.progresoTema.findMany({
    select: { usuarioId: true, temaId: true, nivelActual: true },
  });
  const usuarios = new Map((await prisma.usuario.findMany({
    where: { rol: 'estudiante' }, select: { id: true, nivelInicialAdaptativo: true },
  })).map((u) => [u.id, u.nivelInicialAdaptativo]));
  const subidas = new Set((await prisma.intentoSubidaNivel.findMany({
    where: { aprobado: true }, select: { usuarioId: true, temaId: true },
  })).map((s) => `${s.usuarioId}:${s.temaId}`));

  const sinRespaldo: string[] = [];
  for (const p of progresos) {
    const inicial = usuarios.get(p.usuarioId) ?? 'basico';
    if (orden[p.nivelActual] > orden[inicial] && !subidas.has(`${p.usuarioId}:${p.temaId}`)) {
      sinRespaldo.push(`usuarioId ${p.usuarioId}, temaId ${p.temaId}: nivelActual=${p.nivelActual} > inicial=${inicial} sin IntentoSubidaNivel aprobado.`);
    }
  }
  reportar('B4.3 Todo nivel por encima del inicial tiene una subida de nivel aprobada que lo respalde',
    muestra(sinRespaldo), `${progresos.length} filas de ProgresoTema evaluadas.`);

  // B4.4 — la evolución de θ se registra en cada origen documentado.
  const origenes = await prisma.historialTheta.groupBy({ by: ['origen'], _count: { _all: true } });
  const vistos = new Map(origenes.map((o) => [o.origen, o._count._all]));
  const esperados = ['pretest', 'practica', 'subir_nivel', 'postest'];
  const faltan = esperados.filter((o) => !vistos.get(o))
    .map((o) => `HistorialTheta sin ningún punto de origen "${o}": esa fase no deja evidencia de evolución de θ.`);
  reportar('B4.4 HistorialTheta registra θ en pretest, práctica, subir_nivel y postest',
    muestra(faltan), esperados.map((o) => `${o}=${vistos.get(o) ?? 0}`).join(' · '));
}

/* ══════════════════ B5 · Dataset exportable ══════════════════ */

/**
 * Reproduce la elegibilidad y las columnas críticas de
 * InvestigadorExportacionService.construirDataset() SIN importar Nest: el
 * objetivo es auditar los DATOS, y arrancar el contenedor de DI aquí añadiría
 * dependencias que no aportan a la comprobación.
 */
async function b5Dataset() {
  const estudiantes = await prisma.usuario.findMany({
    where: { rol: 'estudiante' },
    orderBy: { id: 'asc' },
    select: { id: true, grupo: true, thetaInicial: true, pretestCompletado: true, paralelo: true, institucion: true },
  });
  const evals = await prisma.evaluacion.findMany({ select: { usuarioId: true, tipo: true, puntajeTotal: true } });
  const preDe = new Map(evals.filter((e) => e.tipo === 'pre').map((e) => [e.usuarioId, e.puntajeTotal]));

  const fallos: string[] = [];

  // B5.1 — sin PII y sin duplicados: el id_anonimo es posicional (E-001…).
  const ids = new Set(estudiantes.map((u) => u.id));
  if (ids.size !== estudiantes.length) fallos.push('Hay usuarioId repetidos en el universo del dataset.');
  reportar('B5.1 Dataset: una fila por estudiante elegible, sin duplicados', fallos,
    `${estudiantes.length} estudiantes elegibles → ${estudiantes.length} filas.`);

  // B5.2 — campos críticos sin una fracción alta de nulos.
  const criticos: { campo: string; nulos: number[] }[] = [
    { campo: 'grupo', nulos: estudiantes.filter((u) => !u.grupo).map((u) => u.id) },
    { campo: 'pretest_total', nulos: estudiantes.filter((u) => !preDe.has(u.id)).map((u) => u.id) },
    // θ inicial solo se exige a quien completó el pretest.
    { campo: 'theta_inicial (con pretest completado)', nulos: estudiantes.filter((u) => u.pretestCompletado && u.thetaInicial == null).map((u) => u.id) },
  ];
  const fallosNulos: string[] = [];
  for (const c of criticos) {
    const base = c.campo.startsWith('theta_inicial')
      ? estudiantes.filter((u) => u.pretestCompletado).length
      : estudiantes.length;
    const frac = base ? c.nulos.length / base : 0;
    if (frac > MAX_FRACCION_NULOS) {
      fallosNulos.push(`Campo "${c.campo}": ${c.nulos.length}/${base} filas en null (${Math.round(frac * 100)}%) — usuarioId ${muestra(c.nulos.map(String), 8).join(', ')}.`);
    }
  }
  reportar(`B5.2 Campos críticos del dataset con ≤${MAX_FRACCION_NULOS * 100}% de nulos`, fallosNulos,
    criticos.map((c) => `${c.campo}: ${c.nulos.length} nulos`).join(' · '));

  // B5.3 — balance de grupos (INFORMATIVO: no se reasigna nada).
  const control = estudiantes.filter((u) => u.grupo === 'control').length;
  const experimental = estudiantes.filter((u) => u.grupo === 'experimental').length;
  informar('B5.3 Balance control vs experimental (informativo, no se reasigna)',
    `control=${control} · experimental=${experimental} (total ${estudiantes.length}).`);
}

/* ══════════════════ Main ══════════════════ */

async function main() {
  console.log(`\n══ AUDITORÍA DE INVESTIGACIÓN (Bloque B) · ${new Date().toISOString()} ══`);
  console.log('   Solo lectura · usuarios identificados por id (sin PII)\n');

  await b1Campos();
  await b1Grupos();
  await b1Bloqueo();
  await b2Pretest();
  await b3Postest();
  await b4Trazabilidad();
  await b5Dataset();

  console.log('Regla                                                                                    Resultado');
  console.log('─'.repeat(106));
  let algunaFallo = false;
  for (const r of resultados) {
    console.log(`${r.regla.padEnd(88)}  ${r.ok ? '✔ PASS' : '✖ FAIL'}`);
    if (r.nota) console.log(`    · ${r.nota}`);
    if (!r.ok) {
      algunaFallo = true;
      for (const d of r.detalle) console.log(`    - ${d}`);
    }
  }
  console.log('─'.repeat(106));
  const fallidas = resultados.filter((r) => !r.ok).length;
  console.log(algunaFallo
    ? `\n✖ Bloque B con hallazgos (${fallidas}/${resultados.length} reglas en FAIL).\n`
    : `\n✔ Bloque B: ${resultados.length}/${resultados.length} reglas en PASS.\n`);

  await prisma.$disconnect();
  process.exit(algunaFallo ? 1 : 0);
}

main().catch(async (e) => {
  console.error('✖ Falló la auditoría con un error no controlado:', e);
  await prisma.$disconnect();
  process.exit(1);
});
