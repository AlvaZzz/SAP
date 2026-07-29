/**
 * GENERADOR DE RETOS DERIVADOS DEL BANCO — idempotente y trazable.
 *
 *   npx tsx prisma/generar-retos.ts                 → informe, NO escribe (dry-run)
 *   npx tsx prisma/generar-retos.ts --aplicar       → genera/actualiza los retos
 *   npx tsx prisma/generar-retos.ts --unidad 1 --aplicar
 *
 * PRINCIPIO: ningún reto inventa contenido. Cada uno nace de un `Ejercicio` del
 * banco oficial ya validado y reutiliza su código, sus valores y su salida real.
 * La salida esperada NO se adivina: se obtiene EJECUTANDO el código original en el
 * sandbox Piston, que es la misma vía por la que se corregirá al estudiante.
 *
 * CRITERIOS DE GENERACIÓN (ver el informe final del script):
 *  · `depuracion` ← ejercicios con `codigoPython` ejecutable, aplicando UN bug
 *    controlado del catálogo (src/retos/bugs.ts). Es el formato con mejor encaje:
 *    el estudiante recibe código real roto y debe repararlo.
 *  · `resolucion` ← SOLO desde `completar_codigo`. El código con huecos («______»)
 *    es un esqueleto legítimo: el estudiante escribe la parte que falta.
 *  · Se EXCLUYE `predecir_salida` → `resolucion`: pedir "escribe el programa que
 *    imprime 2" se satisface con `print(2)` sin evidenciar aprendizaje alguno.
 *  · Se EXCLUYE `opcion_multiple` y `ordenar_lineas`: son conceptuales y no tienen
 *    programa que escribir; forzarlos exigiría inventar enunciados fuera del módulo.
 */
import { PrismaClient, Prisma, NivelDificultad, TipoBug } from '@prisma/client';
import { introducirBug } from '../src/retos/bugs';

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const APLICAR = args.includes('--aplicar');
const idxUnidad = args.indexOf('--unidad');
const UNIDAD = idxUnidad >= 0 ? Number(args[idxUnidad + 1]) : null;

const PISTON = process.env.PISTON_URL ?? 'http://piston:2000';

/** Ejecuta código en Piston y devuelve stdout (o null si el programa falla). */
async function salidaReal(codigo: string): Promise<string | null> {
  const runtimes = (await (await fetch(`${PISTON}/api/v2/runtimes`)).json()) as Array<{ language: string; version: string }>;
  const version = runtimes.find((r) => r.language === 'python')?.version ?? '3.12.0';
  const res = await fetch(`${PISTON}/api/v2/execute`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      language: 'python', version,
      files: [{ name: 'main.py', content: codigo }],
      stdin: '', run_timeout: 3000, compile_timeout: 3000,
    }),
  });
  const j = (await res.json()) as { run?: { stdout?: string; stderr?: string; code?: number } };
  if (!j.run || j.run.code !== 0) return null;
  const out = (j.run.stdout ?? '').replace(/\s+$/, '');
  return out.length ? out : null;
}

/** Completa los huecos «______» con la respuesta validada del banco. */
function completarHuecos(codigo: string, respuesta: string): string {
  // `respuestaCorrecta` puede traer variantes equivalentes separadas por "|".
  const valor = respuesta.split('|')[0].trim();
  return codigo.replace(/_{2,}/g, valor);
}

interface Informe {
  generados: { tipo: 'resolucion' | 'depuracion'; codigo: string; unidad: number; tema: string; nivel: NivelDificultad; bug: TipoBug | null }[];
  excluidos: { codigo: string; motivo: string }[];
}

async function main() {
  const ejercicios = await prisma.ejercicio.findMany({
    where: {
      banco: 'practica', activo: true,
      tipo: { in: ['predecir_salida', 'completar_codigo'] },
      ...(UNIDAD ? { tema: { unidad: { numero: UNIDAD } } } : {}),
    },
    include: {
      tema: { select: { id: true, numero: true, titulo: true, unidad: { select: { numero: true } } } },
    },
    orderBy: { id: 'asc' },
  });

  // Autor de los retos generados: el sistema los atribuye a un docente real
  // (Reto.autorId es obligatorio y de él cuelgan las notificaciones de revisión).
  const autor = await prisma.usuario.findFirst({ where: { rol: 'docente' }, orderBy: { id: 'asc' } });
  if (!autor) throw new Error('No hay ningún usuario docente para asignar como autor de los retos.');

  const informe: Informe = { generados: [], excluidos: [] };
  const aEscribir: Prisma.RetoCreateInput[] = [];

  for (const ej of ejercicios) {
    const fd = (ej.fuenteDoc ?? {}) as { codigo?: string };
    const codOrigen = fd.codigo;
    const unidad = ej.tema?.unidad.numero ?? 0;
    const tema = ej.tema?.numero ?? '—';

    if (!codOrigen) { informe.excluidos.push({ codigo: `id ${ej.id}`, motivo: 'sin código de banco en fuenteDoc' }); continue; }
    if (!ej.codigoPython) { informe.excluidos.push({ codigo: codOrigen, motivo: 'sin codigoPython (conceptual: no hay programa que escribir ni depurar)' }); continue; }

    // El código de referencia es el ORIGINAL ya validado; si trae huecos, se
    // completan con la respuesta correcta del banco (sigue siendo contenido del módulo).
    const codigoCompleto = ej.tipo === 'completar_codigo'
      ? completarHuecos(ej.codigoPython, ej.respuestaCorrecta)
      : ej.codigoPython;

    const salida = await salidaReal(codigoCompleto);
    if (!salida) {
      informe.excluidos.push({ codigo: codOrigen, motivo: 'el código original no produce salida ejecutable (requiere input() o falla)' });
      continue;
    }

    const base = {
      categoria: ej.categoria,
      nivelDificultad: ej.nivelDificultad,
      estrellas: ej.estrellas,
      xp: ej.xp,
      autor: { connect: { id: autor.id } },
      origenEjercicio: { connect: { id: ej.id } },
      ...(ej.temaId ? { tema: { connect: { id: ej.temaId } } } : {}),
      ejemploSalida: salida,
      autoCalificable: true,
      activo: true,
      fuenteDoc: {
        unidad: String(unidad), tema,
        citaBreve: (ej.explicacionIa ?? ej.enunciado).slice(0, 160),
        origen: 'derivado', origenEjercicio: codOrigen,
      } as Prisma.InputJsonValue,
    };

    /* ── RESOLUCIÓN: solo desde completar_codigo (esqueleto real) ── */
    if (ej.tipo === 'completar_codigo') {
      const codigoReto = `R${codOrigen.slice(1)}-RES`;
      aEscribir.push({
        ...base,
        codigo: codigoReto,
        titulo: `Complétalo tú: ${ej.enunciado.replace(/\s+/g, ' ').slice(0, 60)}`,
        tipo: 'completar_codigo',
        esBugHunt: false,
        enunciado:
          `${ej.enunciado}\n\n` +
          `Escribe el programa completo en Python. Al ejecutarlo debe producir exactamente esta salida:\n${salida}`,
        codigoInicial: ej.codigoPython, // con los huecos, tal como está en el banco
        respuestaCorrecta: codigoCompleto, // solución de referencia (la ve el docente)
        pistas: [
          `Repasa el ejercicio ${codOrigen} del tema ${tema}: ${ej.enunciado.replace(/\s+/g, ' ').slice(0, 140)}`,
          ej.explicacionIa ?? 'Revisa la explicación del ejercicio de origen en el módulo.',
          `Donde ves «______» va: ${ej.respuestaCorrecta.split('|')[0]}`,
        ] as Prisma.InputJsonValue,
      });
      informe.generados.push({ tipo: 'resolucion', codigo: codigoReto, unidad, tema, nivel: ej.nivelDificultad, bug: null });
    } else {
      informe.excluidos.push({ codigo: codOrigen, motivo: 'predecir_salida → resolución omitida: «escribe el programa que imprime X» se resuelve con print(X)' });
    }

    /* ── DEPURACIÓN: un bug controlado sobre el código validado ── */
    const bug = introducirBug(codigoCompleto, codOrigen);
    if (!bug) {
      informe.excluidos.push({ codigo: codOrigen, motivo: 'ninguna transformación del catálogo aplica (código demasiado simple para un bug controlado)' });
      continue;
    }
    // El código con bug DEBE producir una salida distinta; si no, el reto no tiene
    // nada que depurar (p. ej. el bug cae en una rama que no se ejecuta).
    const salidaBug = await salidaReal(bug.codigo);
    if (salidaBug === salida) {
      informe.excluidos.push({ codigo: codOrigen, motivo: 'el bug generado no altera la salida (reto indistinguible del original)' });
      continue;
    }

    const codigoRetoDep = `R${codOrigen.slice(1)}-DEP`;
    aEscribir.push({
      ...base,
      codigo: codigoRetoDep,
      titulo: `Caza el bug: ${ej.enunciado.replace(/\s+/g, ' ').slice(0, 60)}`,
      tipo: 'completar_codigo',
      esBugHunt: true,
      tipoBug: bug.tipo,
      enunciado:
        `Este programa proviene del ejercicio ${codOrigen} del tema ${tema} y debería producir exactamente esta salida:\n${salida}\n\n` +
        `Tiene UN error introducido a propósito. Encuéntralo, corrígelo y vuelve a ejecutarlo.`,
      codigoInicial: bug.codigo,
      respuestaCorrecta: codigoCompleto,
      pistas: [
        `Compara la salida que obtienes con la esperada (${salida.split('\n')[0]}…): el primer punto donde difieren te acerca al error.`,
        `El error está en la línea ${bug.linea}: ${bug.detalle}.`,
        ej.explicacionIa ?? `La versión correcta de esa línea es: ${codigoCompleto.split('\n')[bug.linea - 1] ?? ''}`,
      ] as Prisma.InputJsonValue,
    });
    informe.generados.push({ tipo: 'depuracion', codigo: codigoRetoDep, unidad, tema, nivel: ej.nivelDificultad, bug: bug.tipo });
  }

  /* ── Escritura idempotente (upsert por `codigo`) ── */
  if (APLICAR) {
    for (const data of aEscribir) {
      const { codigo, ...resto } = data;
      await prisma.reto.upsert({
        where: { codigo: codigo! },
        create: data,
        // No se pisa `activo`: si el docente despublicó un reto, sigue despublicado.
        update: { ...resto, activo: undefined },
      });
    }
  }

  /* ── INFORME ── */
  const { generados, excluidos } = informe;
  console.log(`\n══ GENERACIÓN DE RETOS DERIVADOS ${APLICAR ? '' : '(dry-run)'} ══\n`);
  console.log(`Ejercicios candidatos (predecir_salida + completar_codigo): ${ejercicios.length}`);
  console.log(`Retos generados: ${generados.length}  (resolución ${generados.filter((g) => g.tipo === 'resolucion').length} · depuración ${generados.filter((g) => g.tipo === 'depuracion').length})\n`);

  const porUnidad = new Map<number, typeof generados>();
  for (const g of generados) porUnidad.set(g.unidad, [...(porUnidad.get(g.unidad) ?? []), g]);
  for (const [u, gs] of [...porUnidad.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`Unidad ${u}: ${gs.length} retos`);
    const porTema = new Map<string, typeof gs>();
    for (const g of gs) porTema.set(g.tema, [...(porTema.get(g.tema) ?? []), g]);
    for (const [t, ts] of [...porTema.entries()].sort()) {
      const n = (nivel: NivelDificultad) => ts.filter((x) => x.nivel === nivel).length;
      console.log(`   ${t}: ${ts.length}  (bás ${n('basico')} · int ${n('intermedio')} · avz ${n('avanzado')})`);
    }
  }

  const porBug = new Map<string, number>();
  for (const g of generados) if (g.bug) porBug.set(g.bug, (porBug.get(g.bug) ?? 0) + 1);
  if (porBug.size) {
    console.log('\nBugs introducidos por tipo:');
    for (const [b, n] of [...porBug.entries()].sort((a, b2) => b2[1] - a[1])) console.log(`   ${b}: ${n}`);
  }

  const porMotivo = new Map<string, number>();
  for (const e of excluidos) porMotivo.set(e.motivo, (porMotivo.get(e.motivo) ?? 0) + 1);
  console.log(`\nExclusiones (${excluidos.length}):`);
  for (const [m, n] of [...porMotivo.entries()].sort((a, b) => b[1] - a[1])) console.log(`   ${n.toString().padStart(3)} · ${m}`);

  if (!APLICAR) console.log('\n(dry-run) No se escribió nada. Re-ejecuta con --aplicar.\n');
  else console.log(`\n✔ ${aEscribir.length} retos escritos (upsert por código).\n`);
}

main()
  .catch((e) => { console.error('✖', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
