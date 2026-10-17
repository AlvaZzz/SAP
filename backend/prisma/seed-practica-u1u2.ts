/**
 * ════════════════════════════════════════════════════════════════════════════
 *  BANCO DE LA PRÁCTICA Nro. 1 (PRG-111, II/2026) — Unidades 1 y 2
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  Carga dos archivos entregados por el autor con revisión pedagógica:
 *    · prisma/data/banco_unidades_1_y_2.json  → 60 preguntas (10 integradoras
 *      por unidad, cada una en básico/intermedio/avanzado) y 40 retos.
 *    · prisma/data/retos_bugs_unidades_1_y_2.json → 30 retos "Encuentra el bug".
 *
 *  Reparto (Parte D del documento):
 *    · Banco de PRÁCTICA: las 60 preguntas, cada una en su "Tema en PREXI".
 *    · Banco de EXAMEN: las versiones intermedias (10 por unidad), marcadas
 *      como integradoras: el examen de unidad las prefiere sobre las demás. Las
 *      preguntas de examen anteriores de U1 y U2 se desactivan (no se borran).
 *    · Retos: los 40 de la práctica y los 30 de depuración, en su tema.
 *
 *  A diferencia de seed-unidad.ts, este script NO BORRA NADA: es aditivo e
 *  idempotente. Cada ítem se identifica por su código (fuenteDoc.codigo); si ya
 *  existe se actualiza su contenido y si no, se crea. Se puede repetir sin
 *  duplicar y no toca el avance de los estudiantes.
 *
 *  Uso (dentro del contenedor api o con DATABASE_URL apuntando a la base):
 *    npx ts-node prisma/seed-practica-u1u2.ts            # simula y muestra el plan
 *    npx ts-node prisma/seed-practica-u1u2.ts --aplicar  # escribe en la base
 * ════════════════════════════════════════════════════════════════════════════
 */
import { PrismaClient, Prisma, NivelDificultad, TipoEjercicio, Banco, TipoBug } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { equilibrarClavesLetras, SEMILLA_BANCO } from '../src/common/banco/clave-equilibrada';
import { toparXp } from '../src/common/xp/tope';

const prisma = new PrismaClient();
const APLICAR = process.argv.includes('--aplicar');
const DATA = path.join(__dirname, 'data');

interface FuenteDoc { unidad: string; tema: string; citaBreve: string; codigo: string }
interface Pregunta {
  categoria: string; tipo: TipoEjercicio; nivel: NivelDificultad; b?: number;
  enunciado: string; codigoPython?: string; xp?: number; explicacion?: string;
  opciones?: { id: string; texto: string }[]; respuestaCorrecta: string;
  fuenteDoc: FuenteDoc; temasCombinados?: string[]; esExamenIntermedio?: boolean;
}
interface Reto {
  codigo: string; titulo: string; categoria: string; tema: string;
  nivelSugerido: 'intermedio' | 'avanzado'; enunciado: string;
  codigoInicial?: string; ejemploEntrada?: string; ejemploSalida?: string;
  pruebas?: { label: string; stdin?: string; salida: string }[];
  solucionReferencia?: string; criteriosEvaluacion?: string[];
  tipoBug?: TipoBug | null; pistas?: string[]; xp?: number;
  esBugHunt?: boolean; autoCalificable?: boolean; activo?: boolean;
  fuenteDoc: FuenteDoc;
}

const ESTRELLAS: Record<NivelDificultad, number> = { basico: 2, intermedio: 3, avanzado: 4 };
const B_DEFECTO: Record<NivelDificultad, number> = { basico: -1, intermedio: 0, avanzado: 1 };
const TIPOS: TipoEjercicio[] = ['opcion_multiple', 'predecir_salida', 'completar_codigo', 'ordenar_lineas'];
const TIPOS_BUG: TipoBug[] = ['operador_aritmetico_invertido', 'operador_relacional_invertido', 'limite_rango_corrido', 'orden_lineas_intercambiado', 'variable_trocada'];

const leer = <T>(archivo: string): T => JSON.parse(fs.readFileSync(path.join(DATA, archivo), 'utf8')) as T;
/** "1.5.2 Operadores relacionales" → "1.5.2" */
const numeroDe = (s: string) => s.match(/^\d+(?:\.\d+)*/)?.[0] ?? '';

/** Texto que el estudiante ve en un reto: enunciado + pruebas de escritorio + criterios. */
function enunciadoReto(r: Reto): string {
  const partes = [r.enunciado];
  if (r.pruebas?.length) {
    partes.push('── Pruebas de escritorio ──\n' + r.pruebas.map((p, i) =>
      `${i + 1}. ${p.label}${p.stdin ? `\n   Entrada: ${p.stdin.trim().replace(/\n/g, ' · ')}` : ''}\n   Salida esperada:\n${p.salida.split('\n').map((l) => `     ${l}`).join('\n')}`,
    ).join('\n'));
  }
  if (r.criteriosEvaluacion?.length) partes.push('── Criterios de evaluación ──\n' + r.criteriosEvaluacion.map((c) => `• ${c}`).join('\n'));
  return partes.join('\n\n');
}

async function main() {
  const banco = leer<{ fuente: string; unidades: Record<string, { ejercicios: Pregunta[]; retos: Reto[] }> }>('banco_unidades_1_y_2.json');
  const bugs = leer<{ fuente: string; retos: Reto[] }>('retos_bugs_unidades_1_y_2.json');

  // ── Temario de la base: número de tema → id, por unidad ──
  const temas = await prisma.tema.findMany({ where: { unidad: { numero: { in: [1, 2] } } }, select: { id: true, numero: true, unidad: { select: { numero: true } } } });
  const temaId = new Map(temas.map((t) => [`${t.unidad.numero}|${t.numero}`, t.id]));
  const idDe = (unidad: string | number, numero: string) => temaId.get(`${unidad}|${numero}`);

  // ── Validación completa antes de escribir ──
  const errores: string[] = [];
  const preguntas: (Pregunta & { unidad: string })[] = [];
  for (const [u, contenido] of Object.entries(banco.unidades)) {
    for (const p of contenido.ejercicios) {
      const c = p.fuenteDoc?.codigo ?? '(sin código)';
      if (!p.fuenteDoc?.codigo) errores.push(`Pregunta sin fuenteDoc.codigo: "${p.enunciado.slice(0, 50)}"`);
      if (!idDe(u, p.fuenteDoc?.tema)) errores.push(`${c}: el tema ${p.fuenteDoc?.tema} no existe en la Unidad ${u}`);
      if (!TIPOS.includes(p.tipo)) errores.push(`${c}: tipo desconocido "${p.tipo}"`);
      if (!['basico', 'intermedio', 'avanzado'].includes(p.nivel)) errores.push(`${c}: nivel desconocido "${p.nivel}"`);
      if (!p.respuestaCorrecta) errores.push(`${c}: sin respuesta correcta`);
      if ((p.tipo === 'opcion_multiple' || p.tipo === 'predecir_salida') && !p.opciones?.some((o) => o.id === p.respuestaCorrecta)) {
        errores.push(`${c}: la respuesta "${p.respuestaCorrecta}" no es ninguna de las opciones`);
      }
      for (const tc of p.temasCombinados ?? []) if (!idDe(u, numeroDe(tc))) errores.push(`${c}: tema combinado "${tc}" no existe`);
      preguntas.push({ ...p, unidad: u });
    }
  }
  const retos = [...Object.values(banco.unidades).flatMap((x) => x.retos), ...bugs.retos];
  const codigos = new Set<string>();
  for (const r of retos) {
    if (codigos.has(r.codigo)) errores.push(`Reto ${r.codigo}: código repetido`);
    codigos.add(r.codigo);
    if (!idDe(r.fuenteDoc?.unidad ?? r.tema.split('.')[0], r.tema)) errores.push(`Reto ${r.codigo}: el tema ${r.tema} no existe`);
    if (r.tipoBug && !TIPOS_BUG.includes(r.tipoBug)) errores.push(`Reto ${r.codigo}: tipoBug desconocido "${r.tipoBug}"`);
    if (r.esBugHunt && (!r.codigoInicial || !r.ejemploSalida)) errores.push(`Reto ${r.codigo}: un reto de bug necesita código con el bug y salida esperada`);
  }
  if (errores.length) {
    console.error(`✖ El banco tiene ${errores.length} problema(s); no se escribió nada:\n  · ${errores.join('\n  · ')}`);
    process.exit(1);
  }

  // Clave equilibrada: el material concentra la respuesta en A/B; se reparte de
  // forma determinista moviendo texto y clave a la vez (igual que seed-unidad).
  const conLetra = preguntas.filter((p) => (p.tipo === 'opcion_multiple' || p.tipo === 'predecir_salida') && (p.opciones?.length ?? 0) >= 2);
  equilibrarClavesLetras(conLetra.map((p) => ({ enunciado: p.enunciado, opciones: p.opciones!, respuestaCorrecta: p.respuestaCorrecta })), SEMILLA_BANCO)
    .forEach((r, i) => { if (r.aplicado) { conLetra[i].opciones = r.opciones; conLetra[i].respuestaCorrecta = r.respuestaCorrecta; } });

  const nivelBase = await prisma.nivel.findFirst({ orderBy: { numero: 'asc' } });
  const autor = (await prisma.usuario.findFirst({ where: { rol: 'docente', activo: true }, orderBy: { id: 'asc' } }))
    ?? (await prisma.usuario.findFirst({ where: { rol: 'admin' }, orderBy: { id: 'asc' } }));
  if (!nivelBase || !autor) { console.error('✖ Faltan un Nivel o un docente en la base (ejecuta antes el seed general).'); process.exit(1); }

  const datosPregunta = (p: Pregunta & { unidad: string }, b: Banco) => ({
    titulo: p.enunciado.slice(0, 80),
    categoria: p.categoria, nivelId: nivelBase.id, temaId: idDe(p.unidad, p.fuenteDoc.tema)!,
    estrellas: ESTRELLAS[p.nivel], nivelDificultad: p.nivel,
    dificultadB: p.b ?? B_DEFECTO[p.nivel],
    tipo: p.tipo, enunciado: p.enunciado, codigoPython: p.codigoPython ?? null,
    opciones: (p.opciones ?? []) as unknown as Prisma.InputJsonValue,
    respuestaCorrecta: p.respuestaCorrecta,
    xp: toparXp(p.xp ?? 15), explicacionIa: p.explicacion ?? null,
    banco: b, activo: true,
    temasIntegrados: [...new Set((p.temasCombinados ?? []).map((tc) => idDe(p.unidad, numeroDe(tc))!))],
    fuenteDoc: p.fuenteDoc as unknown as Prisma.InputJsonValue,
  });

  const cuenta = { practica: { nuevos: 0, actualizados: 0 }, examen: { nuevos: 0, actualizados: 0, desactivados: 0 }, retos: { nuevos: 0, actualizados: 0 } };
  const guardarPregunta = async (tx: Prisma.TransactionClient, p: Pregunta & { unidad: string }, b: Banco) => {
    const data = datosPregunta(p, b);
    const previo = await tx.ejercicio.findFirst({ where: { banco: b, fuenteDoc: { path: ['codigo'], equals: p.fuenteDoc.codigo } }, select: { id: true } });
    if (previo) { await tx.ejercicio.update({ where: { id: previo.id }, data }); cuenta[b === 'examen' ? 'examen' : 'practica'].actualizados++; }
    else { await tx.ejercicio.create({ data }); cuenta[b === 'examen' ? 'examen' : 'practica'].nuevos++; }
  };

  const escribir = async (tx: Prisma.TransactionClient) => {
    for (const p of preguntas) {
      await guardarPregunta(tx, p, Banco.practica);
      if (p.esExamenIntermedio) await guardarPregunta(tx, p, Banco.examen);
    }
    // El examen de cada unidad son EXACTAMENTE sus 10 versiones intermedias: las
    // preguntas de examen anteriores de U1 y U2 se DESACTIVAN (no se borran: se
    // conservan los intentos ya rendidos y se pueden reactivar).
    const codigosExamen = preguntas.filter((p) => p.esExamenIntermedio).map((p) => p.fuenteDoc.codigo);
    const anteriores = await tx.ejercicio.findMany({
      where: { banco: Banco.examen, activo: true, temaId: { in: temas.map((t) => t.id) } },
      select: { id: true, fuenteDoc: true },
    });
    const sobran = anteriores.filter((e) => !codigosExamen.includes((e.fuenteDoc as { codigo?: string } | null)?.codigo ?? '')).map((e) => e.id);
    if (sobran.length) await tx.ejercicio.updateMany({ where: { id: { in: sobran } }, data: { activo: false } });
    cuenta.examen.desactivados = sobran.length;
    for (const r of retos) {
      const data = {
        titulo: r.titulo, categoria: r.categoria,
        temaId: idDe(r.fuenteDoc?.unidad ?? r.tema.split('.')[0], r.tema)!,
        estrellas: r.nivelSugerido === 'avanzado' ? 4 : 3,
        nivelDificultad: r.nivelSugerido,
        tipo: 'completar_codigo' as TipoEjercicio,
        enunciado: enunciadoReto(r),
        codigoInicial: r.codigoInicial ?? null,
        ejemploEntrada: r.ejemploEntrada ?? null,
        ejemploSalida: r.ejemploSalida ?? null,
        // La solución de referencia la ve el docente al revisar.
        respuestaCorrecta: r.solucionReferencia ?? null,
        xp: toparXp(r.xp ?? 25),
        esBugHunt: r.esBugHunt ?? false,
        tipoBug: r.tipoBug ?? null,
        pistas: (r.pistas ?? []) as unknown as Prisma.InputJsonValue,
        autoCalificable: r.autoCalificable ?? false,
        activo: r.activo ?? true,
        fuenteDoc: r.fuenteDoc as unknown as Prisma.InputJsonValue,
      };
      const previo = await tx.reto.findUnique({ where: { codigo: r.codigo }, select: { id: true } });
      if (previo) { await tx.reto.update({ where: { id: previo.id }, data }); cuenta.retos.actualizados++; }
      else { await tx.reto.create({ data: { ...data, codigo: r.codigo, autorId: autor.id } }); cuenta.retos.nuevos++; }
    }
  };

  const porTema: Record<string, Record<NivelDificultad, number>> = {};
  for (const p of preguntas) { (porTema[p.fuenteDoc.tema] ??= { basico: 0, intermedio: 0, avanzado: 0 })[p.nivel]++; }

  if (!APLICAR) {
    console.log('Simulación (no se escribió nada). Para cargar: --aplicar');
    console.log(`  ${preguntas.length} preguntas de práctica · ${preguntas.filter((p) => p.esExamenIntermedio).length} de examen · ${retos.length} retos (${bugs.retos.length} de bug)`);
    for (const [t, n] of Object.entries(porTema)) console.log(`    Tema ${t}: básico +${n.basico} · intermedio +${n.intermedio} · avanzado +${n.avanzado}`);
    return;
  }

  await prisma.$transaction(escribir, { timeout: 120_000 });
  console.log('✔ Banco de la Práctica Nro. 1 cargado (nada se borró):');
  console.log(`  Práctica: ${cuenta.practica.nuevos} nuevos, ${cuenta.practica.actualizados} actualizados`);
  console.log(`  Examen de unidad: ${cuenta.examen.nuevos} nuevos, ${cuenta.examen.actualizados} actualizados, ${cuenta.examen.desactivados} anteriores desactivados`);
  console.log(`  Retos: ${cuenta.retos.nuevos} nuevos, ${cuenta.retos.actualizados} actualizados (autor: ${autor.nombre})`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
