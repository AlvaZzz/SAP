/**
 * MIGRACIÓN: EQUILIBRAR LA CLAVE DE RESPUESTAS EN LA BASE DE DATOS.
 *
 *   npx tsx scripts/equilibrar-clave-bd.ts            → SIMULACIÓN (no escribe)
 *   npx tsx scripts/equilibrar-clave-bd.ts --aplicar  → escribe (en transacción)
 *
 * Por qué: el contenido ya sembrado concentra la respuesta correcta en una
 * posición (hasta un 100 % en "A" en el banco de diagnóstico). Un estudiante que
 * marque siempre la misma letra puntúa alto sin dominar el contenido, y esa
 * puntuación contamina θ (IRT), el nivel adaptativo asignado y la comparación
 * pre/post: es un defecto del INSTRUMENTO, no de la interfaz.
 *
 * Qué hace exactamente:
 *   · ACTUALIZA los ejercicios existentes (columnas `opciones` y
 *     `respuesta_correcta`). NO los borra ni los recrea: se conservan los ids y
 *     todas las referencias (Intento, PretestRespuesta, PasoRuta, retos derivados).
 *   · Reordena solo los tipos cuya clave es una LETRA de opción
 *     (opcion_multiple, predecir_salida). `ordenar_lineas` (clave "B,A,D,C") y
 *     `completar_codigo` (texto libre) NO se tocan.
 *   · Mueve el TEXTO correcto y su clave a la vez
 *     (src/common/banco/clave-equilibrada); nunca se recalcula la clave aparte.
 *   · Es IDEMPOTENTE: volver a ejecutarlo no cambia nada.
 *
 * Reproducibilidad: el destino de cada ítem depende solo de su identidad
 * (enunciado + textos de sus opciones) y de la semilla SEMILLA_BANCO, no del
 * orden de lectura. El agrupamiento aquí es por (banco, unidad), que no tiene por
 * qué coincidir con el de un sembrado desde cero (que agrupa por archivo de
 * origen): ambas disposiciones son válidas y están equilibradas, pero no son
 * idénticas entre sí. Para la tesis, la disposición vigente es la de la base.
 *
 * SEGURIDAD DEL DATO: antes de escribir cuenta las RESPUESTAS YA REGISTRADAS
 * sobre los ejercicios afectados. Si hay respuestas de cuentas que no son de
 * demostración, ABORTA: las respuestas se guardan como letra, y al reordenar las
 * opciones esa letra pasaría a significar otra cosa. Esa decisión es del
 * investigador, no del script.
 */
import { PrismaClient, Prisma, TipoEjercicio } from '@prisma/client';
import {
  distribucionClave,
  equilibrarClavesLetras,
  ItemLetra,
  OpcionLetra,
  SEMILLA_BANCO,
} from '../src/common/banco/clave-equilibrada';

const prisma = new PrismaClient();
const APLICAR = process.argv.includes('--aplicar');
/** Cuentas de demostración: sus respuestas se pueden descartar sin consecuencias. */
const DOMINIO_DEMO = '@demo.prexi.local';
const TIPOS_CON_LETRA: TipoEjercicio[] = ['opcion_multiple', 'predecir_salida'];

interface Fila {
  id: number;
  banco: string;
  tipo: TipoEjercicio;
  enunciado: string;
  opciones: unknown;
  respuestaCorrecta: string;
  temaId: number | null;
}

/** Las opciones viven en una columna Json; se valida la forma antes de usarlas. */
function comoOpciones(v: unknown): OpcionLetra[] | null {
  if (!Array.isArray(v)) return null;
  const ops = v.filter(
    (o): o is OpcionLetra =>
      !!o &&
      typeof o === 'object' &&
      typeof (o as OpcionLetra).id === 'string' &&
      typeof (o as OpcionLetra).texto === 'string',
  );
  return ops.length === v.length && ops.length >= 2 ? ops : null;
}

function porcentajes(letras: string[]): string {
  const c = distribucionClave(letras);
  const n = letras.length || 1;
  return ['A', 'B', 'C', 'D'].map((l) => `${l}:${c[l] ?? 0} (${Math.round(((c[l] ?? 0) / n) * 100)}%)`).join('  ');
}

function maxPct(letras: string[]): number {
  const c = distribucionClave(letras);
  return letras.length ? Math.max(...Object.values(c)) / letras.length : 0;
}

async function main() {
  console.log(`\n══ EQUILIBRADO DE LA CLAVE EN LA BASE ══  modo: ${APLICAR ? 'APLICAR (escribe)' : 'SIMULACIÓN (no escribe)'}`);
  console.log(`   semilla: "${SEMILLA_BANCO}"\n`);

  const ejercicios = (await prisma.ejercicio.findMany({
    where: { tipo: { in: TIPOS_CON_LETRA } },
    select: { id: true, banco: true, tipo: true, enunciado: true, opciones: true, respuestaCorrecta: true, temaId: true },
    orderBy: { id: 'asc' },
  })) as unknown as Fila[];

  if (ejercicios.length === 0) {
    console.log('No hay ejercicios de opción en la base. Nada que hacer.\n');
    return;
  }

  // Unidad de cada tema, para agrupar el reparto por (banco, unidad).
  const temas = await prisma.tema.findMany({ select: { id: true, unidadId: true } });
  const unidadDeTema = new Map(temas.map((t) => [t.id, t.unidadId]));

  const grupos = new Map<string, Fila[]>();
  const saltados: Fila[] = [];
  for (const e of ejercicios) {
    if (!comoOpciones(e.opciones)) {
      saltados.push(e);
      continue;
    }
    const g = `${e.banco}/u${e.temaId != null ? (unidadDeTema.get(e.temaId) ?? '?') : 'sin-tema'}`;
    const arr = grupos.get(g);
    if (arr) arr.push(e);
    else grupos.set(g, [e]);
  }

  /* ── Cálculo del cambio (sin escribir todavía) ── */
  interface Cambio {
    id: number;
    opciones: OpcionLetra[];
    respuestaCorrecta: string;
  }
  const cambios: Cambio[] = [];
  const resumen: Array<{ grupo: string; n: number; antes: string[]; despues: string[] }> = [];

  for (const [grupo, filas] of [...grupos.entries()].sort()) {
    const entrada: ItemLetra[] = filas.map((f) => ({
      enunciado: f.enunciado,
      opciones: comoOpciones(f.opciones)!,
      respuestaCorrecta: f.respuestaCorrecta,
    }));
    const salida = equilibrarClavesLetras(entrada, SEMILLA_BANCO);
    salida.forEach((r, i) => {
      if (!r.aplicado) {
        saltados.push(filas[i]);
        return;
      }
      const antes = entrada[i];
      const cambia =
        r.respuestaCorrecta !== antes.respuestaCorrecta ||
        r.opciones.some((o, k) => o.id !== antes.opciones[k].id || o.texto !== antes.opciones[k].texto);
      if (cambia) cambios.push({ id: filas[i].id, opciones: r.opciones, respuestaCorrecta: r.respuestaCorrecta });
    });
    resumen.push({
      grupo,
      n: filas.length,
      antes: entrada.map((e) => e.respuestaCorrecta),
      despues: salida.map((r) => r.respuestaCorrecta),
    });
  }

  console.log('── Distribución por banco/unidad ──');
  for (const r of resumen) {
    console.log(`  ${r.grupo.padEnd(22)} n=${String(r.n).padStart(4)}`);
    console.log(`     antes  : ${porcentajes(r.antes)}   máx ${Math.round(maxPct(r.antes) * 100)}%${maxPct(r.antes) > 0.35 ? '  ← SESGADO' : ''}`);
    console.log(`     después: ${porcentajes(r.despues)}   máx ${Math.round(maxPct(r.despues) * 100)}%`);
  }
  const todasAntes = resumen.flatMap((r) => r.antes);
  const todasDespues = resumen.flatMap((r) => r.despues);
  console.log(`\n  TOTAL antes  : ${porcentajes(todasAntes)}   máx ${Math.round(maxPct(todasAntes) * 100)}%`);
  console.log(`  TOTAL después: ${porcentajes(todasDespues)}   máx ${Math.round(maxPct(todasDespues) * 100)}%`);
  console.log(`\n  Ejercicios a actualizar: ${cambios.length} de ${ejercicios.length}`);
  if (saltados.length) {
    console.log(`  Saltados (opciones con forma inesperada o clave que no apunta a ninguna opción): ${saltados.length}`);
    for (const s of saltados.slice(0, 10)) console.log(`     - #${s.id} [${s.banco}] "${s.enunciado.slice(0, 60)}"`);
  }

  /* ── Respuestas ya registradas sobre los ejercicios afectados ── */
  const ids = cambios.map((c) => c.id);
  const [intentosTotal, intentosDemo, pretestTotal, pretestDemo] = await Promise.all([
    prisma.intento.count({ where: { ejercicioId: { in: ids } } }),
    prisma.intento.count({ where: { ejercicioId: { in: ids }, usuario: { email: { endsWith: DOMINIO_DEMO } } } }),
    prisma.pretestRespuesta.count({ where: { ejercicioId: { in: ids } } }),
    prisma.pretestRespuesta.count({ where: { ejercicioId: { in: ids }, usuario: { email: { endsWith: DOMINIO_DEMO } } } }),
  ]);
  const realIntentos = intentosTotal - intentosDemo;
  const realPretest = pretestTotal - pretestDemo;

  console.log('\n── Respuestas ya registradas sobre esos ejercicios ──');
  console.log(`  Intento          : ${intentosTotal} (${intentosDemo} de cuentas demo → ${realIntentos} reales)`);
  console.log(`  PretestRespuesta : ${pretestTotal} (${pretestDemo} de cuentas demo → ${realPretest} reales)`);

  if (realIntentos + realPretest > 0) {
    const usuarios = await prisma.usuario.findMany({
      where: {
        email: { not: { endsWith: DOMINIO_DEMO } },
        OR: [
          { intentos: { some: { ejercicioId: { in: ids } } } },
          { pretestRespuestas: { some: { ejercicioId: { in: ids } } } },
        ],
      },
      select: { id: true, nombre: true, email: true, rol: true },
      orderBy: { id: 'asc' },
    });
    console.log('\n  ⚠ HAY RESPUESTAS DE CUENTAS QUE NO SON DE DEMOSTRACIÓN:');
    for (const u of usuarios.slice(0, 25)) console.log(`     - #${u.id} ${u.nombre} <${u.email}> (${u.rol})`);
    if (usuarios.length > 25) console.log(`     … y ${usuarios.length - 25} más`);
    console.log(
      '\n  Las respuestas se guardan como LETRA. Al reordenar las opciones, esa letra\n' +
        '  pasaría a significar otra cosa y esas respuestas quedarían invalidadas.\n' +
        '  El script NO escribe. Decisión del investigador:\n' +
        '    (a) descartar esas respuestas si son de prueba, y volver a ejecutar;\n' +
        '    (b) equilibrar solo los ejercicios que aún no tienen respuestas;\n' +
        '    (c) posponer y recolectar con el banco actual (no recomendable: el\n' +
        '        sesgo de la clave invalida la medición).\n',
    );
    return;
  }

  if (!APLICAR) {
    console.log('\n  SIMULACIÓN: no se escribió nada. Ejecuta con --aplicar para confirmar.\n');
    return;
  }

  await prisma.$transaction(
    cambios.map((c) =>
      prisma.ejercicio.update({
        where: { id: c.id },
        data: { opciones: c.opciones as unknown as Prisma.InputJsonValue, respuestaCorrecta: c.respuestaCorrecta },
      }),
    ),
    { timeout: 120_000 },
  );
  console.log(`\n  ✔ ${cambios.length} ejercicios actualizados (ids conservados).\n`);
}

main()
  .catch((e) => {
    console.error('✖ Falló la migración (la transacción se revierte entera):', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
