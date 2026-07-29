import { Injectable } from '@nestjs/common';
import { NivelDificultad, TipoEjercicio } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { ETIQUETA_NIVEL, siguienteNivel } from '../common/niveles/nivel-dificultad';

const TIPO_LABEL: Record<TipoEjercicio, string> = {
  opcion_multiple: 'Opción múltiple',
  predecir_salida: 'Predecir la salida',
  completar_codigo: 'Completar el código',
  ordenar_lineas: 'Ordenar las líneas',
};

/**
 * Título LEGIBLE para mostrar en recomendaciones. Varios ejercicios sembrados
 * (sobre todo "predecir_salida") usan como título la primera línea del código
 * ('x = 0', 'def op(a, b):'), que no describe nada. Si el título parece código,
 * se construye uno descriptivo con datos reales del ejercicio: tipo + categoría
 * ("Predecir la salida: Bucles").
 */
function tituloDescriptivo(e: { titulo: string; tipo: TipoEjercicio; categoria: string }): string {
  const t = e.titulo.trim();
  const pareceCodigo = /=|:$|^(def|for|while|if|print|import|return)\b|\bprint\(/.test(t);
  return pareceCodigo ? `${TIPO_LABEL[e.tipo]}: ${e.categoria}` : e.titulo;
}

@Injectable()
export class GamificacionService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Resumen del dashboard (stat cards + desempeño por categoría) ──
  async resumen(usuarioId: number) {
    const [rk, total, completados, intentos] = await Promise.all([
      this.prisma.ranking.findUnique({ where: { usuarioId } }),
      this.prisma.ejercicio.count({ where: { banco: 'practica', activo: true } }),
      this.prisma.intento.findMany({ where: { usuarioId, correcto: true }, distinct: ['ejercicioId'], select: { ejercicioId: true } }),
      this.prisma.intento.findMany({ where: { usuarioId }, select: { correcto: true, ejercicio: { select: { categoria: true } } } }),
    ]);

    const porCat = new Map<string, { ok: number; total: number }>();
    for (const i of intentos) {
      const c = i.ejercicio.categoria;
      const e = porCat.get(c) ?? { ok: 0, total: 0 };
      e.total++; if (i.correcto) e.ok++;
      porCat.set(c, e);
    }

    return {
      puntos: rk?.xpTotal ?? 0,
      posicion: rk?.posicion ?? null,
      racha_dias: rk?.rachaDias ?? 0,
      ejercicios: { completados: completados.length, total },
      desempeno_categorias: [...porCat.entries()].map(([categoria, v]) => ({
        categoria, porcentaje: v.total ? Math.round((v.ok / v.total) * 100) : 0,
      })).sort((a, b) => a.categoria.localeCompare(b.categoria)),
    };
  }

  // ── Logros (desbloqueados a color, resto bloqueados con su condición) ──
  async logros(usuarioId: number) {
    const todos = await this.prisma.logro.findMany({
      orderBy: { id: 'asc' },
      include: { usuarios: { where: { usuarioId } } },
    });
    return todos.map((l) => ({
      id: l.id, clave: l.clave, nombre: l.nombre, condicion: l.condicion, icono: l.icono,
      obtenido: l.usuarios.length > 0,
      fecha_obtenido: l.usuarios[0]?.fechaObtenido ?? null,
    }));
  }

  /**
   * MOTOR DE RECOMENDACIÓN (reglas, sin IA generativa) — "Recomendado por ALVARO".
   *
   * Con datos REALES del estudiante puntúa cada TEMA desbloqueado y elige 3
   * ejercicios (de su NIVEL actual en ese tema, aún no resueltos) que más lo
   * ayuden a avanzar. Señales, en orden de peso:
   *  · FALLOS en el tema (refuerzo de debilidades) ................ 30 pts c/u
   *  · θ bajo en el tema (habilidad estimada IRT, HistorialTheta) . hasta 30
   *  · CERCANÍA al umbral del tema (te faltan ≤3 aciertos) ........ hasta 20
   * La RAZÓN que se muestra sale de la señal dominante de ese tema (con sus
   * números reales), nunca de un texto genérico. No se recomiendan ejercicios
   * ya resueltos correctamente ni temas/unidades bloqueados (mismo gate
   * secuencial por examen de unidad que usa UnidadesService).
   */
  async recomendados(usuarioId: number) {
    const [usuario, unidades, aprobados, intentos, historial] = await Promise.all([
      this.prisma.usuario.findUnique({ where: { id: usuarioId }, select: { nivelInicialAdaptativo: true } }),
      this.prisma.unidad.findMany({
        orderBy: [{ orden: 'asc' }, { numero: 'asc' }],
        include: {
          temas: {
            where: { padreId: null, publicado: true },
            orderBy: [{ orden: 'asc' }, { numero: 'asc' }],
            include: {
              progreso: { where: { usuarioId } },
              subtemas: {
                where: { publicado: true },
                orderBy: [{ orden: 'asc' }, { numero: 'asc' }],
                include: { progreso: { where: { usuarioId } } },
              },
            },
          },
        },
      }),
      this.prisma.examenUnidad.findMany({ where: { usuarioId, aprobado: true }, select: { unidadId: true }, distinct: ['unidadId'] }),
      this.prisma.intento.findMany({
        where: { usuarioId },
        select: { ejercicioId: true, correcto: true, ejercicio: { select: { temaId: true } } },
      }),
      this.prisma.historialTheta.findMany({
        where: { usuarioId, temaId: { not: null } },
        orderBy: { fecha: 'asc' },
        select: { temaId: true, theta: true },
      }),
    ]);

    // Agregados reales por tema: fallos, correctos distintos y último θ.
    const fallosPorTema = new Map<number, number>();
    const correctosPorTema = new Map<number, Set<number>>();
    const resueltosOk = new Set<number>();
    for (const it of intentos) {
      const tid = it.ejercicio.temaId;
      if (it.correcto) {
        resueltosOk.add(it.ejercicioId);
        if (tid != null) {
          const s = correctosPorTema.get(tid) ?? new Set<number>();
          s.add(it.ejercicioId);
          correctosPorTema.set(tid, s);
        }
      } else if (tid != null) {
        fallosPorTema.set(tid, (fallosPorTema.get(tid) ?? 0) + 1);
      }
    }
    const thetaPorTema = new Map<number, number>();
    for (const h of historial) if (h.temaId != null) thetaPorTema.set(h.temaId, h.theta); // orden asc → queda el último

    // Temas CANDIDATOS: solo de unidades desbloqueadas (gate por examen) y temas
    // desbloqueados (mismo default que UnidadesService para filas sin progreso).
    const nivelInicial: NivelDificultad = usuario?.nivelInicialAdaptativo ?? 'basico';
    const aprobadas = new Set(aprobados.map((a) => a.unidadId));
    interface Cand { temaId: number; unidadNumero: number; temaNumero: string; temaTitulo: string; nivelActual: NivelDificultad; umbral: number }
    const candidatos: Cand[] = [];
    let anteriorAprobada = true;
    const conTemas = unidades.filter((u) => u.temas.length > 0);
    conTemas.forEach((u, iu) => {
      const desbloqueada = anteriorAprobada;
      anteriorAprobada = aprobadas.has(u.id);
      if (!desbloqueada) return;
      u.temas.forEach((t, it) => {
        const pr = t.progreso[0];
        const desb = pr?.desbloqueado ?? (iu === 0 && it === 0);
        if (desb) candidatos.push({ temaId: t.id, unidadNumero: u.numero, temaNumero: t.numero, temaTitulo: t.titulo, nivelActual: pr?.nivelActual ?? nivelInicial, umbral: t.umbral });
        t.subtemas.forEach((s, is) => {
          const prs = s.progreso[0];
          const desbS = desb && (prs?.desbloqueado ?? is === 0);
          if (desbS) candidatos.push({ temaId: s.id, unidadNumero: u.numero, temaNumero: s.numero, temaTitulo: s.titulo, nivelActual: prs?.nivelActual ?? nivelInicial, umbral: s.umbral });
        });
      });
    });
    if (candidatos.length === 0) return [];

    // Puntúa cada tema y deriva la RAZÓN desde su señal dominante (datos reales).
    const thetas = candidatos.map((c) => thetaPorTema.get(c.temaId)).filter((v): v is number => v != null);
    const thetaMin = thetas.length ? Math.min(...thetas) : null;
    const puntuados = candidatos
      .map((c) => {
        const fallos = fallosPorTema.get(c.temaId) ?? 0;
        const theta = thetaPorTema.get(c.temaId) ?? null;
        const faltan = Math.max(0, c.umbral - (correctosPorTema.get(c.temaId)?.size ?? 0));
        let score = fallos * 30;
        if (theta != null) score += Math.max(0, 1.5 - theta) * 20;
        if (faltan > 0 && faltan <= 3) score += 25 - faltan * 5;

        let razon: string;
        if (fallos > 0) razon = `Fallaste ${fallos} ejercicio${fallos === 1 ? '' : 's'} de este tema`;
        else if (theta != null && thetaMin != null && theta === thetaMin && thetas.length > 1) razon = `Refuerza tu punto más débil (θ ${theta.toFixed(2)})`;
        else if (faltan > 0 && faltan <= 3) razon = `Estás cerca: ${faltan} acierto${faltan === 1 ? '' : 's'} más y completas este tema`;
        else {
          const sig = siguienteNivel(c.nivelActual);
          razon = sig
            ? `Dominar ${ETIQUETA_NIVEL[c.nivelActual]} aquí te acerca a ${ETIQUETA_NIVEL[sig]}`
            : `Mantén tu nivel Avanzado en este tema`;
        }
        return { ...c, score, razon };
      })
      .sort((a, b) => b.score - a.score || a.unidadNumero - b.unidadNumero);

    // Ejercicios candidatos (no resueltos) de esos temas, en una sola consulta.
    const pool = await this.prisma.ejercicio.findMany({
      where: {
        banco: 'practica', activo: true,
        temaId: { in: candidatos.map((c) => c.temaId) },
        id: { notIn: resueltosOk.size ? [...resueltosOk] : [0] },
      },
      orderBy: [{ estrellas: 'asc' }, { id: 'asc' }],
      select: { id: true, titulo: true, xp: true, temaId: true, nivelDificultad: true, tipo: true, categoria: true },
    });

    // 1ª pasada: un ejercicio por tema (del NIVEL ACTUAL del estudiante en ese
    // tema; si no hay de ese nivel, cualquiera del tema). 2ª pasada: si aún no
    // hay 3, completa con más ejercicios de los mejores temas.
    const usados = new Set<number>();
    const resultado: { id: number; titulo: string; xp: number; nivel: NivelDificultad; nivel_label: string; unidad_numero: number; tema_numero: string; tema_titulo: string; razon: string }[] = [];
    const agregar = (c: (typeof puntuados)[number], soloUnoPorTema: boolean) => {
      if (resultado.length >= 3) return;
      const delTema = pool.filter((e) => e.temaId === c.temaId && !usados.has(e.id));
      const elegido = delTema.find((e) => e.nivelDificultad === c.nivelActual) ?? delTema[0];
      if (!elegido) return;
      usados.add(elegido.id);
      resultado.push({
        id: elegido.id, titulo: tituloDescriptivo(elegido), xp: elegido.xp,
        nivel: elegido.nivelDificultad, nivel_label: ETIQUETA_NIVEL[elegido.nivelDificultad],
        unidad_numero: c.unidadNumero, tema_numero: c.temaNumero, tema_titulo: c.temaTitulo,
        razon: c.razon,
      });
      if (!soloUnoPorTema) agregar(c, false);
    };
    for (const c of puntuados) agregar(c, true);
    for (const c of puntuados) { if (resultado.length >= 3) break; agregar(c, false); }
    return resultado;
  }

  // ── Actividad semanal (intentos, aciertos y XP por día) ──
  //  Una sola consulta de los últimos 7 días, agregada en memoria (evita 14+
  //  counts). El XP diario alimenta los sparklines de las stat cards.
  async actividad(usuarioId: number) {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const desde = new Date(hoy); desde.setDate(hoy.getDate() - 6);
    const intentos = await this.prisma.intento.findMany({
      where: { usuarioId, fecha: { gte: desde } },
      select: { correcto: true, xpOtorgado: true, fecha: true },
    });
    const porDia = new Map<string, { intentos: number; aciertos: number; xp: number }>();
    for (const it of intentos) {
      const k = it.fecha.toISOString().slice(0, 10);
      const e = porDia.get(k) ?? { intentos: 0, aciertos: 0, xp: 0 };
      e.intentos++; if (it.correcto) e.aciertos++; e.xp += it.xpOtorgado;
      porDia.set(k, e);
    }
    const dias: { dia: string; intentos: number; aciertos: number; xp: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(hoy); d.setDate(hoy.getDate() - i);
      const k = d.toISOString().slice(0, 10);
      dias.push({ dia: k, ...(porDia.get(k) ?? { intentos: 0, aciertos: 0, xp: 0 }) });
    }
    return dias;
  }

  // ── Actividad reciente (últimos intentos, con ubicación académica) + tasa global ──
  async recientes(usuarioId: number) {
    const [intentos, total, correctos] = await Promise.all([
      this.prisma.intento.findMany({
        where: { usuarioId },
        orderBy: { fecha: 'desc' },
        take: 8,
        select: {
          correcto: true, xpOtorgado: true, fecha: true,
          ejercicio: {
            select: {
              titulo: true, categoria: true,
              tema: { select: { titulo: true, unidad: { select: { numero: true } } } },
            },
          },
        },
      }),
      this.prisma.intento.count({ where: { usuarioId } }),
      this.prisma.intento.count({ where: { usuarioId, correcto: true } }),
    ]);
    return {
      tasa_acierto: total ? Math.round((correctos / total) * 100) : null,
      recientes: intentos.map((i) => ({
        titulo: i.ejercicio.titulo,
        ubicacion: i.ejercicio.tema
          ? `Unidad ${i.ejercicio.tema.unidad.numero} · ${i.ejercicio.tema.titulo}`
          : i.ejercicio.categoria,
        correcto: i.correcto,
        xp: i.xpOtorgado,
        fecha: i.fecha,
      })),
    };
  }
}
