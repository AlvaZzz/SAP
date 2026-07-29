import { Injectable } from '@nestjs/common';
import { NivelDificultad } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ETIQUETA_NIVEL } from '../../common/niveles/nivel-dificultad';
import { nivelDesdeTheta } from '../../mediciones/irt/irt';
import { AdaptatividadService } from '../../ejercicios/adaptatividad.service';

export interface EstadoAccesoRetos {
  acceso: boolean;
  /** Nivel global orientativo (θ IRT). NO decide qué retos ve: eso es por tema. */
  nivel: NivelDificultad;
  nivel_label: string;
  modulo_habilitado: boolean;
  motivo: string | null;
}

/**
 * Control de acceso al módulo de RETOS.
 *
 * REGLA VIGENTE: el módulo se abre o se cierra con UN interruptor del docente
 * (`ConfiguracionSistema.retosHabilitado`). Dentro, cada reto se muestra según el
 * nivel del estudiante EN SU TEMA (ver RetosService.disponibles) — los tres
 * niveles participan, igual que en los ejercicios de práctica.
 *
 * REGLA ANTERIOR (sustituida): el acceso dependía de la habilidad IRT GLOBAL (θ) y
 * de dos permisos por nivel del docente, y Básico nunca entraba. Se cambió porque
 * el nivel global no refleja que un estudiante puede ir Avanzado en un tema y
 * Básico en otro, y porque excluir a Básico lo dejaba sin práctica de código.
 * `retosIntermedioHabilitado`/`retosAvanzadoHabilitado` quedan en el esquema solo
 * para no perder la configuración previa; ya no gobiernan nada.
 */
@Injectable()
export class RetosAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adaptatividad: AdaptatividadService,
  ) {}

  /** Nivel global del estudiante según su θ (IRT). Informativo. */
  async nivelActual(usuarioId: number): Promise<NivelDificultad> {
    const theta = await this.adaptatividad.thetaActual(usuarioId);
    return theta == null ? 'basico' : nivelDesdeTheta(theta);
  }

  async estado(usuarioId: number): Promise<EstadoAccesoRetos> {
    const [nivel, cfg] = await Promise.all([
      this.nivelActual(usuarioId),
      this.prisma.configuracionSistema.findUnique({ where: { id: 1 }, select: { retosHabilitado: true } }),
    ]);
    const habilitado = cfg?.retosHabilitado ?? false;

    return {
      acceso: habilitado,
      nivel,
      nivel_label: ETIQUETA_NIVEL[nivel],
      modulo_habilitado: habilitado,
      motivo: habilitado ? null : 'Tu docente aún no habilitó los retos de código.',
    };
  }
}
