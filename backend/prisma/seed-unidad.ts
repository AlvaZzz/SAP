/**
 * SEED DE UNA UNIDAD (contenido oficial UPEA) — idempotente y transaccional.
 *
 *   npx tsx prisma/seed-unidad.ts                  → siembra la Unidad 1
 *   npx tsx prisma/seed-unidad.ts --unidad 2       → siembra la Unidad 2
 *   npx tsx prisma/seed-unidad.ts --force          → siembra aunque existan intentos (los cascadea)
 *   npx tsx prisma/seed-unidad.ts --data ruta.json → usa otro archivo de contenido
 *
 * FUENTE DE DATOS: prisma/data/unidad<N>.json (lo entrega el autor con revisión
 * pedagógica). Este script NO genera contenido: lo lee y lo siembra. Cada ítem
 * DEBE traer `fuenteDoc` (unidad/tema/subtema?/paginaPDF?/citaBreve) trazable al
 * material oficial de la UPEA de esa unidad.
 *
 * SEGURIDAD (PASO 0):
 *  - Respaldo previo a prisma/backups/unidad<N>-<fecha>.json (estado actual).
 *  - Chequeo de datos de estudiantes (Intento/PasoRuta/RetoUsuario sobre la unidad):
 *    si existen y no se pasó --force, ABORTA con el detalle (borrarlos afecta datos).
 *  - Borrado + inserción dentro de UNA transacción (si algo falla, revierte).
 *  - Acotado a la unidad indicada: bancos `practica` y `examen` de sus temas + sus
 *    retos. Los TEMAS no se borran (se upsertean por número; los ausentes del JSON
 *    se despublican) para no romper ProgresoTema ni los ítems de pretest ligados.
 *  - PRETEST/POSTEST INTACTOS: los bancos `pretest` y `postest` JAMÁS se tocan
 *    aquí (instrumentos de medición del estudio).
 *
 * Al terminar genera docs/unidad<N>-trazabilidad.md (+ .csv) para el docente.
 */
import { PrismaClient, Prisma, NivelDificultad, TipoEjercicio, Banco } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { equilibrarClavesLetras, ItemLetra, SEMILLA_BANCO } from '../src/common/banco/clave-equilibrada';
import { XP_MAX_ITEM, toparXp } from '../src/common/xp/tope';

const prisma = new PrismaClient();

/* ── Tipos del archivo de contenido (prisma/data/unidad1.json) ── */
interface FuenteDoc { unidad: string; tema: string; subtema?: string; paginaPDF?: number; citaBreve: string; codigo?: string }
interface ItemEjercicio {
  titulo?: string; categoria: string;
  tipo: TipoEjercicio; nivel: NivelDificultad;
  /** Dificultad b esperada (juicio de experto, escala θ). Si falta: básico −1, intermedio 0, avanzado +1. */
  b?: number;
  enunciado: string; codigoPython?: string;
  opciones?: { id: string; texto: string }[];
  respuestaCorrecta: string; explicacion?: string; xp?: number;
  fuenteDoc: FuenteDoc;
}
interface ItemReto {
  titulo: string; categoria: string;
  tipo?: TipoEjercicio; nivelSugerido?: 'intermedio' | 'avanzado';
  enunciado: string; codigoInicial?: string;
  ejemploEntrada?: string; ejemploSalida?: string;
  /** Solución de referencia (la ve el docente al revisar). */
  solucionReferencia?: string;
  /** Criterios de evaluación (se anexan al enunciado, visibles como rúbrica). */
  criteriosEvaluacion?: string[];
  xp?: number; esBugHunt?: boolean; activo?: boolean;
  fuenteDoc: FuenteDoc;
}
interface TemaJson {
  numero: string; titulo: string; descripcion?: string; umbral?: number; publicado?: boolean;
  subtemas?: TemaJson[];
  ejercicios?: ItemEjercicio[];
  retos?: ItemReto[];
}
interface Contenido {
  unidad: { numero: number; titulo?: string; descripcion?: string };
  /** Cita de la(s) fuente(s) oficiales; encabeza el reporte de trazabilidad. */
  fuente?: string;
  /** Email del docente autor de los retos (si falta: primer usuario con rol docente). */
  autorEmail?: string;
  temas: TemaJson[];
  /** Ítems del EXAMEN de fin de unidad (banco `examen`). Opcional: si falta, el banco examen no se toca. */
  examen?: ItemEjercicio[];
}

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const unidadIdx = args.indexOf('--unidad');
const NUM_UNIDAD = unidadIdx >= 0 ? Number(args[unidadIdx + 1]) : 1;
const dataIdx = args.indexOf('--data');
const DATA_PATH = dataIdx >= 0 ? args[dataIdx + 1] : path.join(__dirname, 'data', `unidad${NUM_UNIDAD}.json`);

const ESTRELLAS: Record<NivelDificultad, number> = { basico: 2, intermedio: 3, avanzado: 4 };
const B_DEFECTO: Record<NivelDificultad, number> = { basico: -1, intermedio: 0, avanzado: 1 };
const XP_DEFECTO: Record<NivelDificultad, number> = { basico: 10, intermedio: 15, avanzado: 20 };

function fallo(msg: string): never {
  console.error(`\n✖ ${msg}`);
  process.exit(1);
}

/** Valida un ítem: todo debe traer fuenteDoc completo y datos coherentes. */
function validarItem(donde: string, it: ItemEjercicio): string[] {
  const e: string[] = [];
  if (!it.enunciado?.trim()) e.push('sin enunciado');
  if (!it.respuestaCorrecta?.toString().trim()) e.push('sin respuestaCorrecta');
  if (!it.categoria?.trim()) e.push('sin categoria');
  if (!['opcion_multiple', 'predecir_salida', 'completar_codigo', 'ordenar_lineas'].includes(it.tipo)) e.push(`tipo inválido "${it.tipo}"`);
  if (!['basico', 'intermedio', 'avanzado'].includes(it.nivel)) e.push(`nivel inválido "${it.nivel}"`);
  if ((it.tipo === 'opcion_multiple' || it.tipo === 'predecir_salida' || it.tipo === 'ordenar_lineas') && !(it.opciones?.length)) e.push('sin opciones');
  const f = it.fuenteDoc;
  if (!f || !f.tema || !f.citaBreve) e.push('fuenteDoc incompleto (tema/citaBreve)');
  // `paginaPDF` es OPCIONAL: los bancos entregados como documento propio (ej.
  // "PREXI_Unidad1_Banco_Ejercicios.pdf") citan el módulo por contenido pero no
  // por página. Si viene, debe ser un número; el reporte distingue ambos casos.
  else if (f.paginaPDF !== undefined && typeof f.paginaPDF !== 'number') e.push('fuenteDoc.paginaPDF debe ser un número');
  // COHERENCIA nivel ↔ dificultad b (evita el bug de "badge Avanzado con contenido
  // básico"): si b viene declarada, debe caer en la ventana del nivel. Se REPORTA
  // en vez de insertarse mal.
  if (typeof it.b === 'number') {
    const ventana: Record<NivelDificultad, [number, number]> = { basico: [-3, -0.2], intermedio: [-0.8, 0.8], avanzado: [0.2, 3] };
    const [min, max] = ventana[it.nivel] ?? [-3, 3];
    if (it.b < min || it.b > max) e.push(`b=${it.b} incoherente con nivel "${it.nivel}" (esperado ${min}..${max})`);
  }
  return e.map((x) => `${donde}: ${x}`);
}

/** Tipos cuya `respuestaCorrecta` es la LETRA de una opcion (los unicos equilibrables). */
const TIPOS_CON_LETRA: TipoEjercicio[] = ['opcion_multiple', 'predecir_salida'];

/**
 * Reparte la posicion de la respuesta correcta de todo el archivo de contenido
 * (ejercicios de temas/subtemas + items de examen), MUTANDO los items en memoria
 * antes de sembrarlos. Trabaja sobre el conjunto completo para que el reparto sea
 * uniforme a nivel de banco, no tema a tema. Devuelve cuantos items se reubicaron.
 */
function equilibrarClave(contenido: Contenido): number {
  const items: ItemEjercicio[] = [];
  const recoger = (ts: TemaJson[]) => {
    for (const t of ts) {
      items.push(...(t.ejercicios ?? []));
      recoger(t.subtemas ?? []);
    }
  };
  recoger(contenido.temas);
  items.push(...(contenido.examen ?? []));

  const equilibrables = items.filter((it) => TIPOS_CON_LETRA.includes(it.tipo) && (it.opciones?.length ?? 0) >= 2);
  const entrada: ItemLetra[] = equilibrables.map((it) => ({
    enunciado: it.enunciado,
    opciones: it.opciones!,
    respuestaCorrecta: it.respuestaCorrecta,
  }));

  let n = 0;
  equilibrarClavesLetras(entrada, SEMILLA_BANCO).forEach((r, i) => {
    if (!r.aplicado) {
      console.warn(`  (!) "${equilibrables[i].enunciado.slice(0, 60)}": respuestaCorrecta "${equilibrables[i].respuestaCorrecta}" no apunta a ninguna opcion; se deja como esta.`);
      return;
    }
    equilibrables[i].opciones = r.opciones;
    equilibrables[i].respuestaCorrecta = r.respuestaCorrecta;
    n += 1;
  });
  return n;
}

async function main() {
  /* ── PASO 1: cargar el archivo de contenido autorizado ── */
  if (!fs.existsSync(DATA_PATH)) {
    fallo(
      `No existe el archivo de contenido: ${DATA_PATH}\n` +
      `  Colócalo siguiendo el formato de prisma/data/unidad1.ejemplo.json\n` +
      `  (ver prisma/data/README-unidades.md). Este script NO genera contenido.`,
    );
  }
  const contenido = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8')) as Contenido;
  if (contenido.unidad?.numero !== NUM_UNIDAD) {
    fallo(`El archivo declara unidad.numero = ${contenido.unidad?.numero} pero se pidió sembrar la Unidad ${NUM_UNIDAD}. Usa --unidad ${contenido.unidad?.numero} o corrige el archivo.`);
  }

  /* Validación completa ANTES de tocar la base. */
  const errores: string[] = [];
  const walkTemas = (ts: TemaJson[], padre?: string) => {
    for (const t of ts) {
      if (!new RegExp(`^${NUM_UNIDAD}\\.`).test(t.numero)) errores.push(`Tema ${t.numero}: no pertenece a la Unidad ${NUM_UNIDAD}`);
      (t.ejercicios ?? []).forEach((it, i) => errores.push(...validarItem(`Tema ${t.numero} ej#${i + 1}`, it)));
      (t.retos ?? []).forEach((r, i) => {
        if (!r.fuenteDoc?.tema) errores.push(`Tema ${t.numero} reto#${i + 1}: fuenteDoc incompleto`);
        if (!r.enunciado?.trim()) errores.push(`Tema ${t.numero} reto#${i + 1}: sin enunciado`);
      });
      if (t.subtemas?.length && padre) errores.push(`Subtema ${t.numero}: el sistema soporta 2 niveles (Tema→Subtema); usa fuenteDoc.subtema para el 3er nivel`);
      walkTemas(t.subtemas ?? [], t.numero);
    }
  };
  walkTemas(contenido.temas);
  // El examen se compone SOLO de temas del temario sembrado (no inventar fuera del banco).
  const numerosTemario = new Set<string>();
  const juntar = (ts: TemaJson[]) => { for (const t of ts) { numerosTemario.add(t.numero); juntar(t.subtemas ?? []); } };
  juntar(contenido.temas);
  (contenido.examen ?? []).forEach((it, i) => {
    errores.push(...validarItem(`Examen ítem#${i + 1}`, it));
    if (it.fuenteDoc?.tema && !numerosTemario.has(it.fuenteDoc.tema)) errores.push(`Examen ítem#${i + 1}: fuenteDoc.tema "${it.fuenteDoc.tema}" no existe en el temario`);
  });
  if (errores.length) fallo(`El archivo de contenido tiene ${errores.length} problema(s):\n  - ${errores.slice(0, 30).join('\n  - ')}`);

  /* -- EQUILIBRADO DE LA CLAVE (antes de tocar la base) --
     El material entregado concentra la respuesta correcta en una posicion (en
     unidad1.json, un 73 % en "B"). Asi el banco deja de medir conocimiento: quien
     marque siempre la misma letra puntua alto sin dominarlo, y esa puntuacion
     contamina la theta (IRT), el nivel adaptativo y la comparacion pre/post. Se
     reparte de forma uniforme y DETERMINISTA (misma semilla => misma disposicion,
     ver src/common/banco/clave-equilibrada), moviendo texto y clave a la vez.
     Solo afecta a los tipos con clave por letra; ordenar_lineas (clave "B,A,D,C")
     y completar_codigo (texto libre) quedan intactos. */
  const nEquilibrados = equilibrarClave(contenido);
  console.log(`(*) Clave de respuestas equilibrada en ${nEquilibrados} item(s) de opcion (semilla "${SEMILLA_BANCO}").`);

  /* ── Resolver la unidad y su contexto ── */
  const unidad = await prisma.unidad.findFirst({ where: { numero: NUM_UNIDAD }, orderBy: { id: 'asc' } });
  if (!unidad) fallo(`No existe la Unidad ${NUM_UNIDAD} en la base. Ejecuta primero el seed general.`);
  // Los ejercicios exigen un Nivel (gamificación, 1–5). Se usa el nivel homónimo a
  // la unidad si existe; si no, el primero disponible.
  const nivelBase = (await prisma.nivel.findFirst({ where: { numero: NUM_UNIDAD } }))
    ?? (await prisma.nivel.findFirst({ orderBy: { numero: 'asc' } }));
  if (!nivelBase) fallo('No existe ningún Nivel (requerido por Ejercicio.nivelId).');

  const temasActuales = await prisma.tema.findMany({ where: { unidadId: unidad.id } });
  const temaIdsActuales = temasActuales.map((t) => t.id);

  /* ── PASO 0.5: ¿hay respuestas/resultados de estudiantes ligados a la unidad? ── */
  const [nIntentos, nPasos, nRetoEntregas] = await Promise.all([
    prisma.intento.count({ where: { ejercicio: { temaId: { in: temaIdsActuales }, banco: { in: [Banco.practica, Banco.examen] } } } }),
    prisma.pasoRuta.count({ where: { ejercicio: { temaId: { in: temaIdsActuales }, banco: { in: [Banco.practica, Banco.examen] } } } }),
    prisma.retoUsuario.count({ where: { reto: { temaId: { in: temaIdsActuales } } } }),
  ]);
  if (nIntentos + nPasos + nRetoEntregas > 0 && !FORCE) {
    fallo(
      `Hay DATOS DE ESTUDIANTES ligados a la Unidad ${NUM_UNIDAD} y borrarlos los afecta:\n` +
      `  · ${nIntentos} intentos · ${nPasos} pasos de ruta · ${nRetoEntregas} entregas de retos\n` +
      `  Si estás en pre-producción y aceptas perderlos, re-ejecuta con --force.`,
    );
  }

  /* ── PASO 0.2: RESPALDO del estado actual de la unidad ── */
  const backupDir = path.join(__dirname, 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const respaldo = {
    fecha: new Date().toISOString(),
    unidad,
    temas: temasActuales,
    ejercicios: await prisma.ejercicio.findMany({ where: { temaId: { in: temaIdsActuales }, banco: { in: [Banco.practica, Banco.examen] } } }),
    retos: await prisma.reto.findMany({ where: { temaId: { in: temaIdsActuales } } }),
  };
  const backupPath = path.join(backupDir, `unidad${NUM_UNIDAD}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(respaldo, null, 2), 'utf8');
  console.log(`✔ Respaldo: ${backupPath} (${respaldo.ejercicios.length} ejercicios, ${respaldo.retos.length} retos, ${respaldo.temas.length} temas)`);

  /* Autor de los retos (los retos exigen autorId de un docente). */
  const autor = contenido.autorEmail
    ? await prisma.usuario.findFirst({ where: { email: contenido.autorEmail, rol: 'docente' } })
    : await prisma.usuario.findFirst({ where: { rol: 'docente' }, orderBy: { id: 'asc' } });
  const hayRetos = contenido.temas.some((t) => (t.retos?.length ?? 0) > 0 || (t.subtemas ?? []).some((s) => (s.retos?.length ?? 0) > 0));
  if (hayRetos && !autor) fallo('Los retos requieren un usuario docente como autor y no se encontró ninguno (usa autorEmail en el JSON).');

  /* ── PASOS 0.3 + 2: BORRAR + SEMBRAR en UNA transacción ── */
  const resumen = await prisma.$transaction(async (tx) => {
    // Actualiza metadatos de la unidad si el JSON los trae.
    if (contenido.unidad.titulo || contenido.unidad.descripcion) {
      await tx.unidad.update({
        where: { id: unidad.id },
        data: { ...(contenido.unidad.titulo ? { titulo: contenido.unidad.titulo } : {}), ...(contenido.unidad.descripcion ? { descripcion: contenido.unidad.descripcion } : {}) },
      });
    }

    // 1) UPSERT de temas/subtemas por número (NUNCA delete: protege ProgresoTema
    //    y los ítems de pretest que referencian estos temas).
    const temaIdPorNumero = new Map<string, number>();
    let orden = 0;
    const upsertTema = async (t: TemaJson, padreId: number | null): Promise<void> => {
      orden += 1;
      const existente = await tx.tema.findFirst({ where: { unidadId: unidad.id, numero: t.numero } });
      const data = {
        titulo: t.titulo, descripcion: t.descripcion ?? null, orden,
        umbral: t.umbral ?? 10, publicado: t.publicado ?? true, padreId,
        institucion: unidad.institucion,
      };
      const fila = existente
        ? await tx.tema.update({ where: { id: existente.id }, data })
        : await tx.tema.create({ data: { ...data, unidadId: unidad.id, numero: t.numero } });
      temaIdPorNumero.set(t.numero, fila.id);
      for (const s of t.subtemas ?? []) await upsertTema(s, fila.id);
    };
    for (const t of contenido.temas) await upsertTema(t, null);

    // Temas de la unidad que el material oficial ya no contempla → se DESPUBLICAN (no delete).
    const numerosNuevos = new Set(temaIdPorNumero.keys());
    const despublicados = temasActuales.filter((t) => !numerosNuevos.has(t.numero));
    for (const t of despublicados) await tx.tema.update({ where: { id: t.id }, data: { publicado: false } });

    // 2) BORRADO acotado: SOLO bancos practica+examen de los temas de la unidad,
    //    y sus retos. (pretest/postest quedan intactos por el filtro de banco.)
    const idsUnidad = [...new Set([...temaIdsActuales, ...temaIdPorNumero.values()])];
    const delEj = await tx.ejercicio.deleteMany({ where: { temaId: { in: idsUnidad }, banco: { in: [Banco.practica, Banco.examen] } } });
    const delRetos = await tx.reto.deleteMany({ where: { temaId: { in: idsUnidad } } });

    // 3) INSERCIÓN de ejercicios (banco practica) con fuenteDoc.
    let nEjercicios = 0;
    const porTemaNivel: Record<string, Record<NivelDificultad, number>> = {};
    const insertarEjercicios = async (t: TemaJson) => {
      const temaId = temaIdPorNumero.get(t.numero)!;
      for (const it of t.ejercicios ?? []) {
        await tx.ejercicio.create({
          data: {
            titulo: it.titulo ?? it.enunciado.slice(0, 80),
            categoria: it.categoria, nivelId: nivelBase.id, temaId,
            estrellas: ESTRELLAS[it.nivel], nivelDificultad: it.nivel,
            dificultadB: it.b ?? B_DEFECTO[it.nivel],
            tipo: it.tipo, enunciado: it.enunciado,
            codigoPython: it.codigoPython ?? null,
            opciones: (it.opciones ?? []) as unknown as Prisma.InputJsonValue,
            respuestaCorrecta: it.respuestaCorrecta,
            xp: toparXp(it.xp ?? XP_DEFECTO[it.nivel]),
            explicacionIa: it.explicacion ?? null,
            banco: Banco.practica, activo: true,
            fuenteDoc: it.fuenteDoc as unknown as Prisma.InputJsonValue,
          },
        });
        nEjercicios += 1;
        porTemaNivel[t.numero] ??= { basico: 0, intermedio: 0, avanzado: 0 };
        porTemaNivel[t.numero][it.nivel] += 1;
      }
      for (const s of t.subtemas ?? []) await insertarEjercicios(s);
    };
    for (const t of contenido.temas) await insertarEjercicios(t);

    // 4) RETOS (estilo Práctica 1: análisis → lógica → código). Solo los ven
    //    Intermedio/Avanzado si el docente los habilita (config global existente).
    let nRetos = 0;
    const insertarRetos = async (t: TemaJson) => {
      const temaId = temaIdPorNumero.get(t.numero)!;
      for (const r of t.retos ?? []) {
        const criterios = r.criteriosEvaluacion?.length
          ? `\n\n── Criterios de evaluación ──\n${r.criteriosEvaluacion.map((c) => `• ${c}`).join('\n')}`
          : '';
        await tx.reto.create({
          data: {
            titulo: r.titulo, categoria: r.categoria, temaId,
            estrellas: r.nivelSugerido === 'avanzado' ? 4 : 3,
            tipo: r.tipo ?? 'completar_codigo',
            enunciado: r.enunciado + criterios,
            codigoInicial: r.codigoInicial ?? null,
            ejemploEntrada: r.ejemploEntrada ?? null,
            ejemploSalida: r.ejemploSalida ?? null,
            // La SOLUCIÓN DE REFERENCIA viaja en respuestaCorrecta (la ve el docente al revisar).
            respuestaCorrecta: r.solucionReferencia ?? null,
            xp: toparXp(r.xp ?? XP_MAX_ITEM),
            esBugHunt: r.esBugHunt ?? false,
            activo: r.activo ?? true,
            autorId: autor!.id,
            fuenteDoc: r.fuenteDoc as unknown as Prisma.InputJsonValue,
          },
        });
        nRetos += 1;
      }
      for (const s of t.subtemas ?? []) await insertarRetos(s);
    };
    for (const t of contenido.temas) await insertarRetos(t);

    // 5) EXAMEN de fin de unidad (banco `examen`): SOLO si el JSON lo trae.
    let nExamen = 0;
    for (const it of contenido.examen ?? []) {
      const temaId = temaIdPorNumero.get(it.fuenteDoc.tema) ?? null;
      await tx.ejercicio.create({
        data: {
          titulo: it.titulo ?? it.enunciado.slice(0, 80),
          categoria: it.categoria, nivelId: nivelBase.id, temaId,
          estrellas: ESTRELLAS[it.nivel], nivelDificultad: it.nivel,
          dificultadB: it.b ?? B_DEFECTO[it.nivel],
          tipo: it.tipo, enunciado: it.enunciado,
          codigoPython: it.codigoPython ?? null,
          opciones: (it.opciones ?? []) as unknown as Prisma.InputJsonValue,
          respuestaCorrecta: it.respuestaCorrecta,
          xp: toparXp(it.xp ?? XP_DEFECTO[it.nivel]),
          explicacionIa: it.explicacion ?? null,
          banco: Banco.examen, activo: true,
          fuenteDoc: it.fuenteDoc as unknown as Prisma.InputJsonValue,
        },
      });
      nExamen += 1;
    }

    return { delEj: delEj.count, delRetos: delRetos.count, nEjercicios, nRetos, nExamen, porTemaNivel, despublicados: despublicados.map((t) => t.numero) };
  }, { timeout: 120_000 });

  /* ── PASO 3: reporte de TRAZABILIDAD para el docente ── */
  await generarReporte(unidad.id, contenido.fuente);

  console.log(`\n══ RESUMEN DEL SEED (Unidad ${NUM_UNIDAD}) ══`);
  console.log(`  Borrados: ${resumen.delEj} ejercicios (practica+examen) · ${resumen.delRetos} retos`);
  console.log(`  Sembrados: ${resumen.nEjercicios} ejercicios · ${resumen.nRetos} retos · ${resumen.nExamen} ítems de examen`);
  for (const [tema, niveles] of Object.entries(resumen.porTemaNivel)) {
    console.log(`    Tema ${tema}: básico ${niveles.basico} · intermedio ${niveles.intermedio} · avanzado ${niveles.avanzado}`);
  }
  if (resumen.despublicados.length) console.log(`  Temas despublicados (fuera del material oficial): ${resumen.despublicados.join(', ')}`);
  console.log('  Pretest/postest: INTACTOS (bancos pretest/postest no se tocaron).');
  console.log('  Flashcards: se DERIVAN del banco sembrado (no hay tabla propia) → heredan la trazabilidad.');
}

/** Genera docs/unidad<N>-trazabilidad.md y .csv desde el estado REAL de la base. */
async function generarReporte(unidadId: number, fuente?: string) {
  const temas = await prisma.tema.findMany({ where: { unidadId }, orderBy: [{ orden: 'asc' }, { numero: 'asc' }] });
  const temaPorId = new Map(temas.map((t) => [t.id, t]));
  const ejercicios = await prisma.ejercicio.findMany({
    where: { temaId: { in: temas.map((t) => t.id) }, banco: { in: [Banco.practica, Banco.examen] } },
    orderBy: [{ temaId: 'asc' }, { nivelDificultad: 'asc' }, { id: 'asc' }],
  });
  const retos = await prisma.reto.findMany({ where: { temaId: { in: temas.map((t) => t.id) } }, orderBy: { id: 'asc' } });

  type Fila = { id: string; codigo: string; tipo: string; tema: string; subtema: string; pagina: string; nivel: string; resumen: string; conFuente: boolean };
  const filas: Fila[] = [];
  const fd = (x: unknown): Partial<FuenteDoc> => (x && typeof x === 'object' ? (x as Partial<FuenteDoc>) : {});
  for (const e of ejercicios) {
    const f = fd(e.fuenteDoc);
    filas.push({
      id: `EJ-${e.id}`, codigo: f.codigo ?? '—', tipo: e.banco === Banco.examen ? `examen · ${e.tipo}` : e.tipo,
      tema: f.tema ?? temaPorId.get(e.temaId ?? -1)?.numero ?? '—', subtema: f.subtema ?? '—',
      pagina: f.paginaPDF != null ? String(f.paginaPDF) : '—', nivel: e.nivelDificultad,
      resumen: e.enunciado.replace(/\s+/g, ' ').slice(0, 90), conFuente: !!f.tema,
    });
  }
  for (const r of retos) {
    const f = fd(r.fuenteDoc);
    filas.push({
      id: `RETO-${r.id}`, codigo: f.codigo ?? '—', tipo: `reto${r.esBugHunt ? ' (bug-hunt)' : ''}`,
      tema: f.tema ?? temaPorId.get(r.temaId ?? -1)?.numero ?? '—', subtema: f.subtema ?? '—',
      pagina: f.paginaPDF != null ? String(f.paginaPDF) : '—', nivel: r.estrellas >= 4 ? 'avanzado' : 'intermedio',
      resumen: r.enunciado.replace(/\s+/g, ' ').slice(0, 90), conFuente: !!f.tema,
    });
  }

  const sinFuente = filas.filter((x) => !x.conFuente);
  const conPagina = filas.filter((x) => x.pagina !== '—').length;
  const total = filas.length;
  const md: string[] = [];
  md.push(`# Trazabilidad de la Unidad ${NUM_UNIDAD} — contenido derivado del material oficial`);
  md.push('');
  md.push(`> Generado automáticamente por \`prisma/seed-unidad.ts\` el ${new Date().toLocaleString('es-BO')}.`);
  md.push(`> Fuente: ${fuente ?? `material oficial de la UPEA (PRG-111) para la Unidad ${NUM_UNIDAD}.`}`);
  md.push('');
  md.push('## Resumen');
  md.push('');
  md.push(`- **Ítems totales:** ${total} (${ejercicios.filter((e) => e.banco === Banco.practica).length} ejercicios · ${ejercicios.filter((e) => e.banco === Banco.examen).length} de examen · ${retos.length} retos)`);
  md.push(`- **Con \`fuenteDoc\` (tema del temario):** ${total - sinFuente.length}/${total} ${sinFuente.length === 0 ? '✅ (100%)' : `⚠ faltan ${sinFuente.length}: ${sinFuente.map((x) => x.id).join(', ')}`}`);
  md.push(`- **Con página del módulo (\`paginaPDF\`):** ${conPagina}/${total}. Los ítems sin página provienen del banco entregado como documento propio, que cita el módulo por contenido y no por página; su columna **Código** (ej. \`E${NUM_UNIDAD}.1.I.03\`) es la clave de negocio para localizarlos en ese documento.`);
  md.push('- Las **flashcards** se derivan automáticamente del banco de ejercicios (no hay tabla propia), por lo que heredan esta misma trazabilidad.');
  md.push('- Los bancos **pretest/postest no se tocaron** (instrumentos de medición del estudio).');
  md.push('');
  md.push('### Ejercicios por tema y nivel');
  md.push('');
  md.push('| Tema | Básico | Intermedio | Avanzado | Total |');
  md.push('|------|-------:|-----------:|---------:|------:|');
  for (const t of temas.filter((t) => !t.padreId)) {
    const ids = [t.id, ...temas.filter((s) => s.padreId === t.id).map((s) => s.id)];
    const del = ejercicios.filter((e) => e.banco === Banco.practica && ids.includes(e.temaId ?? -1));
    const c = (n: NivelDificultad) => del.filter((e) => e.nivelDificultad === n).length;
    if (del.length) md.push(`| ${t.numero} ${t.titulo} | ${c('basico')} | ${c('intermedio')} | ${c('avanzado')} | ${del.length} |`);
  }
  md.push('');
  md.push('## Detalle ítem por ítem');
  md.push('');
  md.push('| ID | Código | Tipo | Tema | Subtema | Pág. PDF | Nivel | Enunciado (resumen) |');
  md.push('|----|--------|------|------|---------|---------:|-------|---------------------|');
  for (const x of filas) md.push(`| ${x.id} | ${x.codigo} | ${x.tipo} | ${x.tema} | ${x.subtema} | ${x.pagina} | ${x.nivel} | ${x.resumen.replace(/\|/g, '\\|')} |`);

  // OJO: dentro de Docker solo `backend/` está montado (en /app), así que subir dos
  // niveles desde prisma/ escribiría en el `/docs` EFÍMERO del contenedor y el
  // reporte nunca llegaría al repo. Se escribe dentro de backend/, que sí está
  // montado y es el mismo directorio en host y contenedor.
  const docsDir = path.join(__dirname, '..', 'docs');
  fs.mkdirSync(docsDir, { recursive: true });
  fs.writeFileSync(path.join(docsDir, `unidad${NUM_UNIDAD}-trazabilidad.md`), md.join('\n'), 'utf8');
  const csv = ['id;codigo;tipo;tema;subtema;pagina_pdf;nivel;resumen', ...filas.map((x) => [x.id, x.codigo, x.tipo, x.tema, x.subtema, x.pagina, x.nivel, `"${x.resumen.replace(/"/g, '""')}"`].join(';'))];
  fs.writeFileSync(path.join(docsDir, `unidad${NUM_UNIDAD}-trazabilidad.csv`), '﻿' + csv.join('\n'), 'utf8');
  console.log(`✔ Reporte: docs/unidad${NUM_UNIDAD}-trazabilidad.md + .csv (${total} ítems, ${total - sinFuente.length} con fuenteDoc)`);
}

main()
  .catch((e) => { console.error('✖ El seed falló y la transacción se revirtió:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
