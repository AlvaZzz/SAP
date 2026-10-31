/**
 * ════════════════════════════════════════════════════════════════════════════
 *  BANCOS DE LAS PRÁCTICAS (PRG-111, II/2026) — preguntas integradoras y retos
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  Carga los archivos entregados por el autor con revisión pedagógica que estén
 *  en prisma/data (o solo los que se pidan con --archivo):
 *    · banco_unidades_<a>_y_<b>.json → 10 preguntas integradoras por unidad, cada
 *      una en básico/intermedio/avanzado, y los retos de la práctica
 *      (1_y_2: Práctica Nro. 1 · 3_y_4: Práctica Nro. 2).
 *    · retos_bugs_unidades_<a>_y_<b>.json → retos "Encuentra el bug".
 *
 *  Reparto (Parte D de cada documento):
 *    · Banco de PRÁCTICA: todas las preguntas, cada una en su "Tema en PREXI".
 *    · Banco de EXAMEN: las versiones intermedias (10 por unidad), marcadas
 *      como integradoras: el examen de unidad las prefiere sobre las demás. Las
 *      preguntas de examen anteriores de ESAS unidades se desactivan (no se borran).
 *    · Retos: los de la práctica y los de depuración, en su tema.
 *
 *  A diferencia de seed-unidad.ts, este script NO BORRA NADA: es aditivo e
 *  idempotente. Cada ítem se identifica por su código (fuenteDoc.codigo); si ya
 *  existe se actualiza su contenido y si no, se crea. Se puede repetir sin
 *  duplicar y no toca el avance de los estudiantes.
 *
 *  Uso (dentro del contenedor api o con DATABASE_URL apuntando a la base):
 *    npm run seed:banco                                   # simula y muestra el plan
 *    npm run seed:banco -- --aplicar                      # escribe en la base
 *    npm run seed:banco -- --archivo banco_unidades_3_y_4.json --aplicar   # solo uno
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
interface ArchivoBanco { fuente: string; unidades: Record<string, { ejercicios: Pregunta[]; retos?: Reto[] }> }
type PreguntaCargada = Pregunta & { unidad: string; archivo: string };

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
  const pedidos = process.argv.flatMap((a, i, arr) => (arr[i - 1] === '--archivo' ? [a] : []));
  const archivos = pedidos.length
    ? pedidos
    : fs.readdirSync(DATA).filter((f) => /^(banco_unidades|retos_bugs_unidades)_.*\.json$/.test(f)).sort();
  const bancos = archivos.filter((f) => f.startsWith('banco_')).map((f) => ({ archivo: f, ...leer<ArchivoBanco>(f) }));
  const retosBug = archivos.filter((f) => f.startsWith('retos_bugs_')).flatMap((f) => leer<{ retos: Reto[] }>(f).retos);
  console.log(`Archivos: ${archivos.join(', ')}`);

  // ── Temario de la base: número de tema → id. La unidad es el primer segmento
  // del número ("3.2" → Unidad 3), así una pregunta puede integrar temas de
  // unidades anteriores (p. ej. una de U4 que usa 2.4).
  const temas = await prisma.tema.findMany({ select: { id: true, numero: true, unidad: { select: { numero: true } } } });
  const temaId = new Map(temas.map((t) => [`${t.unidad.numero}|${t.numero}`, t.id]));
  const idDe = (numero: string) => temaId.get(`${String(numero ?? '').split('.')[0]}|${numero}`);

  // ── Validación completa antes de escribir ──
  const errores: string[] = [];
  const preguntas: PreguntaCargada[] = [];
  for (const { archivo, unidades } of bancos) {
    for (const [u, contenido] of Object.entries(unidades)) {
      for (const p of contenido.ejercicios) {
        const c = p.fuenteDoc?.codigo ?? '(sin código)';
        if (!p.fuenteDoc?.codigo) errores.push(`Pregunta sin fuenteDoc.codigo: "${p.enunciado.slice(0, 50)}"`);
        if (!idDe(p.fuenteDoc?.tema) || !p.fuenteDoc.tema.startsWith(`${u}.`)) errores.push(`${c}: el tema ${p.fuenteDoc?.tema} no existe en la Unidad ${u}`);
        if (!TIPOS.includes(p.tipo)) errores.push(`${c}: tipo desconocido "${p.tipo}"`);
        if (!['basico', 'intermedio', 'avanzado'].includes(p.nivel)) errores.push(`${c}: nivel desconocido "${p.nivel}"`);
        if (!p.respuestaCorrecta) errores.push(`${c}: sin respuesta correcta`);
        if ((p.tipo === 'opcion_multiple' || p.tipo === 'predecir_salida') && !p.opciones?.some((o) => o.id === p.respuestaCorrecta)) {
          errores.push(`${c}: la respuesta "${p.respuestaCorrecta}" no es ninguna de las opciones`);
        }
        for (const tc of p.temasCombinados ?? []) if (!idDe(numeroDe(tc))) errores.push(`${c}: tema combinado "${tc}" no existe`);
        preguntas.push({ ...p, unidad: u, archivo });
      }
    }
  }
  const codigosPregunta = new Set<string>();
  for (const p of preguntas) {
    if (codigosPregunta.has(p.fuenteDoc.codigo)) errores.push(`Pregunta ${p.fuenteDoc.codigo}: código repetido`);
    codigosPregunta.add(p.fuenteDoc.codigo);
  }
  const retos = [...bancos.flatMap((b) => Object.values(b.unidades).flatMap((x) => x.retos ?? [])), ...retosBug];
  const codigos = new Set<string>();
  for (const r of retos) {
    if (codigos.has(r.codigo)) errores.push(`Reto ${r.codigo}: código repetido`);
    codigos.add(r.codigo);
    if (!idDe(r.tema)) errores.push(`Reto ${r.codigo}: el tema ${r.tema} no existe`);
    if (r.tipoBug && !TIPOS_BUG.includes(r.tipoBug)) errores.push(`Reto ${r.codigo}: tipoBug desconocido "${r.tipoBug}"`);
    if (r.esBugHunt && (!r.codigoInicial || !r.ejemploSalida)) errores.push(`Reto ${r.codigo}: un reto de bug necesita código con el bug y salida esperada`);
  }
  if (errores.length) {
    console.error(`✖ El banco tiene ${errores.length} problema(s); no se escribió nada:\n  · ${errores.join('\n  · ')}`);
    process.exit(1);
  }

  // Clave equilibrada: el material concentra la respuesta en A/B; se reparte de
  // forma determinista moviendo texto y clave a la vez (igual que seed-unidad).
  // Se hace POR ARCHIVO: cargar un banco nuevo no reordena las opciones de los
  // que ya estaban (ni cambia el sentido de las respuestas ya guardadas).
  for (const { archivo } of bancos) {
    const conLetra = preguntas.filter((p) => p.archivo === archivo && (p.tipo === 'opcion_multiple' || p.tipo === 'predecir_salida') && (p.opciones?.length ?? 0) >= 2);
    equilibrarClavesLetras(conLetra.map((p) => ({ enunciado: p.enunciado, opciones: p.opciones!, respuestaCorrecta: p.respuestaCorrecta })), SEMILLA_BANCO)
      .forEach((r, i) => { if (r.aplicado) { conLetra[i].opciones = r.opciones; conLetra[i].respuestaCorrecta = r.respuestaCorrecta; } });
  }

  const nivelBase = await prisma.nivel.findFirst({ orderBy: { numero: 'asc' } });
  const autor = (await prisma.usuario.findFirst({ where: { rol: 'docente', activo: true }, orderBy: { id: 'asc' } }))
    ?? (await prisma.usuario.findFirst({ where: { rol: 'admin' }, orderBy: { id: 'asc' } }));
  if (!nivelBase || !autor) { console.error('✖ Faltan un Nivel o un docente en la base (ejecuta antes el seed general).'); process.exit(1); }

  const datosPregunta = (p: PreguntaCargada, b: Banco) => ({
    titulo: p.enunciado.slice(0, 80),
    categoria: p.categoria, nivelId: nivelBase.id, temaId: idDe(p.fuenteDoc.tema)!,
    estrellas: ESTRELLAS[p.nivel], nivelDificultad: p.nivel,
    dificultadB: p.b ?? B_DEFECTO[p.nivel],
    tipo: p.tipo, enunciado: p.enunciado, codigoPython: p.codigoPython ?? null,
    opciones: (p.opciones ?? []) as unknown as Prisma.InputJsonValue,
    respuestaCorrecta: p.respuestaCorrecta,
    xp: toparXp(p.xp ?? 15), explicacionIa: p.explicacion ?? null,
    banco: b, activo: true,
    temasIntegrados: [...new Set((p.temasCombinados ?? []).map((tc) => idDe(numeroDe(tc))!))],
    fuenteDoc: p.fuenteDoc as unknown as Prisma.InputJsonValue,
  });

  const cuenta = { practica: { nuevos: 0, actualizados: 0 }, examen: { nuevos: 0, actualizados: 0, desactivados: 0 }, retos: { nuevos: 0, actualizados: 0 } };
  const guardarPregunta = async (tx: Prisma.TransactionClient, p: PreguntaCargada, b: Banco) => {
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
    // El examen de cada unidad cargada son EXACTAMENTE sus versiones intermedias:
    // las preguntas de examen anteriores de esas unidades se DESACTIVAN (no se
    // borran: se conservan los intentos ya rendidos y se pueden reactivar).
    // Solo las unidades que traen preguntas de examen: un archivo de práctica sin examen no debe desactivar el examen vigente.
    const unidadesCargadas = new Set(preguntas.filter((p) => p.esExamenIntermedio).map((p) => p.unidad));
    const codigosExamen = preguntas.filter((p) => p.esExamenIntermedio).map((p) => p.fuenteDoc.codigo);
    const anteriores = await tx.ejercicio.findMany({
      where: { banco: Banco.examen, activo: true, temaId: { in: temas.filter((t) => unidadesCargadas.has(String(t.unidad.numero))).map((t) => t.id) } },
      select: { id: true, fuenteDoc: true },
    });
    const sobran = anteriores.filter((e) => !codigosExamen.includes((e.fuenteDoc as { codigo?: string } | null)?.codigo ?? '')).map((e) => e.id);
    if (sobran.length) await tx.ejercicio.updateMany({ where: { id: { in: sobran } }, data: { activo: false } });
    cuenta.examen.desactivados = sobran.length;
    for (const r of retos) {
      const data = {
        titulo: r.titulo, categoria: r.categoria,
        temaId: idDe(r.tema)!,
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
    console.log(`  ${preguntas.length} preguntas de práctica · ${preguntas.filter((p) => p.esExamenIntermedio).length} de examen · ${retos.length} retos (${retos.filter((r) => r.esBugHunt).length} de bug)`);
    for (const [t, n] of Object.entries(porTema)) console.log(`    Tema ${t}: básico +${n.basico} · intermedio +${n.intermedio} · avanzado +${n.avanzado}`);
    return;
  }

  // Todo o nada. Contra una base remota (Neon) son cientos de idas y vueltas por
  // la red: el límite es amplio para que no se corte a medias.
  await prisma.$transaction(escribir, { timeout: 30 * 60_000, maxWait: 60_000 });
  console.log('✔ Bancos cargados (nada se borró):');
  console.log(`  Práctica: ${cuenta.practica.nuevos} nuevos, ${cuenta.practica.actualizados} actualizados`);
  console.log(`  Examen de unidad: ${cuenta.examen.nuevos} nuevos, ${cuenta.examen.actualizados} actualizados, ${cuenta.examen.desactivados} anteriores desactivados`);
  console.log(`  Retos: ${cuenta.retos.nuevos} nuevos, ${cuenta.retos.actualizados} actualizados (autor: ${autor.nombre})`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
