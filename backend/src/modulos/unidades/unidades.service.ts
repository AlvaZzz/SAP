import { Injectable } from '@nestjs/common';
import { NivelDificultad } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ETIQUETA_NIVEL, siguienteNivel, nivelAlMenos, nivelDominioAgregado } from '../../common/niveles/nivel-dificultad';

// Nivel mínimo de dominio agregado para desbloquear la SIGUIENTE unidad.
const NIVEL_MIN_AVANZAR: NivelDificultad = 'intermedio';

interface EjLite { nivelDificultad: NivelDificultad }

/**
 * Vista del estudiante sobre la jerarquía académica real (Unidad → Tema →
 * Subtema), enriquecida con la ADAPTATIVIDAD por niveles:
 *  - cada tema muestra el NIVEL ACTUAL del estudiante y cuántos ejercicios tiene
 *    de ese nivel, y si puede intentar SUBIR de nivel;
 *  - cada unidad indica su DOMINIO agregado y si está DESBLOQUEADA (la siguiente
 *    unidad exige dominio ≥ Intermedio en la anterior — no basta con básico).
 */
@Injectable()
export class UnidadesService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(usuarioId: number) {
    const [usuario, unidades] = await Promise.all([
      this.prisma.usuario.findUnique({ where: { id: usuarioId }, select: { nivelInicialAdaptativo: true } }),
      this.prisma.unidad.findMany({
        orderBy: [{ orden: 'asc' }, { numero: 'asc' }],
        include: {
          temas: {
            where: { padreId: null, publicado: true },
            orderBy: [{ orden: 'asc' }, { numero: 'asc' }],
            include: {
              ejercicios: { where: { activo: true }, select: { nivelDificultad: true } },
              progreso: { where: { usuarioId } },
              subtemas: {
                where: { publicado: true },
                orderBy: [{ orden: 'asc' }, { numero: 'asc' }],
                include: {
                  ejercicios: { where: { activo: true }, select: { nivelDificultad: true } },
                  progreso: { where: { usuarioId } },
                },
              },
            },
          },
        },
      }),
    ]);

    const nivelInicial: NivelDificultad = usuario?.nivelInicialAdaptativo ?? 'basico';
    const conTemas = unidades.filter((u) => u.temas.length > 0); // oculta unidades sin temas publicados

    // Gate secuencial: la unidad k+1 se desbloquea si la unidad k (en el orden
    // visible) alcanza dominio ≥ Intermedio. La primera siempre está abierta.
    let anteriorDesbloqueaSiguiente = true;

    return conTemas.map((u, iu) => {
      const desbloqueada = anteriorDesbloqueaSiguiente;

      const temas = u.temas.map((t, it) => {
        const pr = t.progreso[0];
        const desbloqueado = desbloqueada && (pr?.desbloqueado ?? (iu === 0 && it === 0));
        const nivelActual: NivelDificultad = pr?.nivelActual ?? nivelInicial;
        return {
          ...this.mapTema(t, nivelActual, desbloqueado),
          subtemas: t.subtemas.map((s, is) => {
            const prs = s.progreso[0];
            const desbSub = desbloqueado && (prs?.desbloqueado ?? (is === 0));
            const nivelSub: NivelDificultad = prs?.nivelActual ?? nivelInicial;
            return this.mapTema(s, nivelSub, desbSub);
          }),
        };
      });

      // DOMINIO de la unidad = promedio del NIVEL en TODOS sus temas y subtemas
      // (lo MISMO que se muestra por tema). Así el dominio nunca contradice a los
      // niveles por tema (si están en Avanzado, el dominio no puede ser Básico) y
      // es independiente del progreso de ejercicios. Se calcula en vivo desde los
      // niveles ya resueltos para garantizar coherencia en la interfaz.
      const niveles: NivelDificultad[] = temas.flatMap((t) => [t.nivel_actual, ...t.subtemas.map((s) => s.nivel_actual)]);
      const { dominioPct, nivelDominio } = nivelDominioAgregado(niveles);
      // ¿Esta unidad habilita la siguiente? (para el próximo iterado)
      anteriorDesbloqueaSiguiente = nivelAlMenos(nivelDominio, NIVEL_MIN_AVANZAR);

      return {
        id: u.id, numero: u.numero, titulo: u.titulo, descripcion: u.descripcion, xp: u.xp,
        desbloqueada,
        dominio_pct: dominioPct,
        nivel_dominio: nivelDominio,
        nivel_dominio_label: ETIQUETA_NIVEL[nivelDominio],
        // Requisito para avanzar a la siguiente unidad (para la barra "progreso para avanzar").
        requiere_nivel: NIVEL_MIN_AVANZAR,
        requiere_nivel_label: ETIQUETA_NIVEL[NIVEL_MIN_AVANZAR],
        habilita_siguiente: nivelAlMenos(nivelDominio, NIVEL_MIN_AVANZAR),
        temas,
      };
    });
  }

  /** Proyecta un tema/subtema con su nivel actual, conteos por nivel y estado. */
  private mapTema(
    t: { id: number; numero: string; titulo: string; descripcion: string | null; umbral: number; ejercicios: EjLite[]; progreso: { ejerciciosCompletados: number }[] },
    nivelActual: NivelDificultad,
    desbloqueado: boolean,
  ) {
    const completados = t.progreso[0]?.ejerciciosCompletados ?? 0;
    const completo = completados >= t.umbral;
    const totalNivel = t.ejercicios.filter((e) => e.nivelDificultad === nivelActual).length;
    const objetivo = siguienteNivel(nivelActual);
    // Avanzado es el nivel máximo: no hay "siguiente nivel" al que subir.
    const nivelMaximo = objetivo === null;
    // Puede subir si no está en Avanzado y existen ejercicios del nivel objetivo.
    const puedeSubir = !!objetivo && t.ejercicios.some((e) => e.nivelDificultad === objetivo);

    return {
      id: t.id, numero: t.numero, titulo: t.titulo, descripcion: t.descripcion,
      umbral: t.umbral, total_ejercicios: t.ejercicios.length,
      total_ejercicios_nivel: totalNivel,
      ejercicios_completados: completados, desbloqueado,
      nivel_actual: nivelActual, nivel_actual_label: ETIQUETA_NIVEL[nivelActual],
      nivel_objetivo: objetivo, nivel_objetivo_label: objetivo ? ETIQUETA_NIVEL[objetivo] : null,
      puede_subir: puedeSubir,
      // El estudiante ya está en el nivel máximo (Avanzado) en este tema.
      nivel_maximo: nivelMaximo,
      estado: completo ? 'completado' : desbloqueado ? 'en_progreso' : 'bloqueado',
    };
  }
}
