// ============================================================
//  Perfil rico del estudiante para ALVARO
//  Reune desde la BD (nunca del frontend) el contexto real del estudiante:
//  nivel del pretest, desempeno reciente en el tema, patrones de error,
//  pistas ya usadas y su ubicacion (unidad/tema/subtema). Con esto ALVARO
//  personaliza la explicacion. Es robusto: ante cualquier fallo devuelve un
//  perfil minimo y NUNCA rompe la respuesta al estudiante.
// ============================================================

import { PrismaService } from '../common/prisma/prisma.service';
import { NivelAlumno, TurnoMemoria } from './prompts';
import { detectarPatrones, PatronError } from './patrones-error';

export interface PerfilEstudiante {
  nombre: string;
  nivel: NivelAlumno;
  nivelEtiqueta: string; // Bajo | Medio | Alto | Sin diagnostico
  pretestPct: number | null;
  categoriasDebiles: string[];
  ubicacion: string | null;
  desempenoTema: { intentos: number; aciertos: number; fallos: number; tiempoProm: number } | null;
  patrones: PatronError[];
  pistasUsadas: { max: number; total: number } | null;
  /** Bloque de texto listo para inyectar en el prompt. */
  resumen: string;
}

export interface OpcionesPerfil {
  temaId?: number | null;
  categoria?: string | null;
  ejercicioId?: number | null;
}

const PERFIL_MINIMO: PerfilEstudiante = {
  nombre: '',
  nivel: 'intermedio',
  nivelEtiqueta: 'Sin diagnostico',
  pretestPct: null,
  categoriasDebiles: [],
  ubicacion: null,
  desempenoTema: null,
  patrones: [],
  pistasUsadas: null,
  resumen: '',
};

/** Nivel pedagogico a partir del % del pretest (o del nivel inicial si no hay pretest). */
function nivelDesde(pretestPct: number | null, nivelInicial: number): { nivel: NivelAlumno; etiqueta: string } {
  if (pretestPct == null) {
    if (nivelInicial >= 3) return { nivel: 'avanzado', etiqueta: 'Sin diagnostico' };
    if (nivelInicial === 2) return { nivel: 'intermedio', etiqueta: 'Sin diagnostico' };
    return { nivel: 'basico', etiqueta: 'Sin diagnostico' };
  }
  if (pretestPct < 50) return { nivel: 'basico', etiqueta: 'Bajo' };
  if (pretestPct <= 75) return { nivel: 'intermedio', etiqueta: 'Medio' };
  return { nivel: 'avanzado', etiqueta: 'Alto' };
}

/** Extrae categorias flojas (porcentaje < 60) del JSON porCategoria del pretest. */
function categoriasDebilesDe(porCategoria: unknown): string[] {
  if (!Array.isArray(porCategoria)) return [];
  return porCategoria
    .filter((c): c is { categoria: string; porcentaje: number } =>
      !!c && typeof c === 'object' &&
      typeof (c as { categoria?: unknown }).categoria === 'string' &&
      typeof (c as { porcentaje?: unknown }).porcentaje === 'number')
    .filter((c) => c.porcentaje < 60)
    .map((c) => c.categoria)
    .slice(0, 4);
}

/** Compone el bloque de texto del perfil para el prompt (conciso, sin relleno). */
function componerResumen(p: Omit<PerfilEstudiante, 'resumen'>): string {
  const lineas: string[] = [];
  lineas.push(`- Nivel diagnosticado: ${p.nivelEtiqueta}${p.pretestPct != null ? ` (pretest ${p.pretestPct}%)` : ''}.`);
  if (p.ubicacion) lineas.push(`- Trabajando en: ${p.ubicacion}.`);
  if (p.categoriasDebiles.length) lineas.push(`- Categorias flojas en el pretest: ${p.categoriasDebiles.join(', ')}.`);
  if (p.desempenoTema && p.desempenoTema.intentos > 0) {
    const d = p.desempenoTema;
    lineas.push(`- Desempeno reciente en el tema: ${d.aciertos} aciertos / ${d.fallos} fallos en ${d.intentos} intentos (tiempo medio ${d.tiempoProm}s).`);
  }
  if (p.patrones.length) {
    lineas.push(`- Errores recurrentes detectados: ${p.patrones.map((x) => x.descripcion).join(' ')}`);
  }
  if (p.pistasUsadas && p.pistasUsadas.total > 0) {
    lineas.push(`- En este ejercicio ya uso ${p.pistasUsadas.total} pista(s) (hasta nivel ${p.pistasUsadas.max}): escala la ayuda, no repitas lo ya dicho.`);
  }
  return lineas.join('\n');
}

/**
 * Construye el perfil del estudiante. Best-effort: cualquier error de BD se
 * traga y se devuelve el perfil minimo (ALVARO sigue respondiendo).
 */
export async function construirPerfil(
  prisma: PrismaService,
  usuarioId: number,
  opts: OpcionesPerfil = {},
): Promise<PerfilEstudiante> {
  if (!usuarioId) return PERFIL_MINIMO;
  try {
    const [usuario, pre, tema] = await Promise.all([
      prisma.usuario.findUnique({ where: { id: usuarioId }, select: { nombre: true, nivelInicial: true } }),
      prisma.evaluacion.findUnique({ where: { usuarioId_tipo: { usuarioId, tipo: 'pre' } }, select: { puntajeTotal: true, porCategoria: true } }).catch(() => null),
      opts.temaId
        ? prisma.tema.findUnique({
            where: { id: opts.temaId },
            select: { numero: true, titulo: true, unidad: { select: { numero: true, titulo: true } }, padre: { select: { numero: true, titulo: true } } },
          }).catch(() => null)
        : Promise.resolve(null),
    ]);

    const pretestPct = pre?.puntajeTotal ?? null;
    const { nivel, etiqueta } = nivelDesde(pretestPct, usuario?.nivelInicial ?? 1);

    // Desempeno reciente + patrones: intentos del tema (o de la categoria) del estudiante.
    let desempenoTema: PerfilEstudiante['desempenoTema'] = null;
    let patrones: PatronError[] = [];
    const dondeEjercicio = opts.temaId
      ? { temaId: opts.temaId }
      : opts.categoria
        ? { categoria: opts.categoria }
        : null;
    if (dondeEjercicio) {
      const intentos = await prisma.intento.findMany({
        where: { usuarioId, ejercicio: dondeEjercicio },
        orderBy: { fecha: 'desc' },
        take: 20,
        select: {
          correcto: true, respuestaDada: true, tiempoSeg: true,
          ejercicio: { select: { categoria: true, tipo: true, respuestaCorrecta: true } },
        },
      });

      if (intentos.length) {
        const aciertos = intentos.filter((i) => i.correcto).length;
        const tiempoTotal = intentos.reduce((s, i) => s + (i.tiempoSeg ?? 0), 0);
        desempenoTema = {
          intentos: intentos.length,
          aciertos,
          fallos: intentos.length - aciertos,
          tiempoProm: Math.round(tiempoTotal / intentos.length),
        };
        patrones = detectarPatrones(intentos.map((i) => ({
          correcto: i.correcto,
          respuestaDada: i.respuestaDada ?? '',
          categoria: i.ejercicio?.categoria ?? '',
          tipo: i.ejercicio?.tipo ?? '',
          respuestaCorrecta: i.ejercicio?.respuestaCorrecta ?? '',
        })));
      }
    }

    // Pistas ya usadas en el ejercicio actual (para escalar la ayuda sin repetir).
    let pistasUsadas: PerfilEstudiante['pistasUsadas'] = null;
    if (opts.ejercicioId) {
      const usadas = await prisma.consultaIa.findMany({
        where: { usuarioId, ejercicioId: opts.ejercicioId, tipo: 'pista' },
        select: { nivelPista: true },
      }).catch(() => [] as { nivelPista: number | null }[]);
      if (usadas.length) {
        pistasUsadas = {
          total: usadas.length,
          max: Math.max(...usadas.map((u) => u.nivelPista ?? 0)),
        };
      }
    }

    const ubicacion = tema
      ? `Unidad ${tema.unidad?.numero ?? '?'} - ${tema.padre ? `${tema.padre.numero} ${tema.padre.titulo} > ` : ''}${tema.numero} ${tema.titulo}`
      : opts.categoria ?? null;

    const base: Omit<PerfilEstudiante, 'resumen'> = {
      nombre: usuario?.nombre?.split(' ')[0] ?? '',
      nivel, nivelEtiqueta: etiqueta, pretestPct,
      categoriasDebiles: categoriasDebilesDe(pre?.porCategoria),
      ubicacion, desempenoTema, patrones, pistasUsadas,
    };
    return { ...base, resumen: componerResumen(base) };
  } catch {
    return PERFIL_MINIMO;
  }
}

/**
 * Memoria conversacional: ultimos turnos (pregunta/respuesta) del estudiante con
 * ALVARO, para que construya sobre lo anterior. Ventana pequena (costo + foco).
 * Se recuperan en orden cronologico ascendente. Best-effort.
 */
export async function recuperarMemoria(
  prisma: PrismaService,
  usuarioId: number,
  tipos: string[],
  limite = 4,
): Promise<TurnoMemoria[]> {
  if (!usuarioId) return [];
  try {
    const filas = await prisma.consultaIa.findMany({
      where: { usuarioId, tipo: { in: tipos } },
      orderBy: { fecha: 'desc' },
      take: limite,
      select: { pregunta: true, respuesta: true },
    });
    const turnos: TurnoMemoria[] = [];
    for (const f of filas.reverse()) {
      if (f.pregunta) turnos.push({ rol: 'estudiante', texto: f.pregunta.slice(0, 300) });
      if (f.respuesta) turnos.push({ rol: 'alvaro', texto: f.respuesta.slice(0, 300) });
    }
    return turnos;
  } catch {
    return [];
  }
}
