import { Injectable, Logger } from '@nestjs/common';
import { NivelDificultad } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AdaptatividadService } from './adaptatividad.service';
import { evaluarAsignacion, rangoDesdeConfig } from '../mediciones/motor/motor';

/** Lo que `EjerciciosService.responder()` mide de cada decisión del motor. */
export interface DecisionMotor {
  ejercicioId: number;
  temaId: number | null;
  dificultadB: number;
  thetaAntes: number | null;
  thetaDespues: number | null;
  nivelAntes: NivelDificultad | null;
  personalizado: boolean;
  correcto: boolean;
  /** ms desde que llegó la respuesta hasta tener re-estimada la habilidad. */
  latenciaMs: number;
}

/**
 * REGISTRO DE LOGS DEL MOTOR ADAPTATIVO (instrumento de la tesis).
 *
 * Escribe una fila de `LogAdaptacion` por cada respuesta de práctica. Se llama
 * SIN esperar (fire-and-forget) después de que la respuesta al estudiante ya
 * está lista: el registro nunca frena ni rompe su flujo. Si falla, se anota en
 * el log del servidor y se sigue.
 */
@Injectable()
export class LogAdaptacionService {
  private readonly logger = new Logger(LogAdaptacionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly adaptatividad: AdaptatividadService,
  ) {}

  async registrar(usuarioId: number, d: DecisionMotor, tiempoRespuestaMs: number): Promise<void> {
    try {
      const cfg = await this.prisma.configuracionSistema.findUnique({
        where: { id: 1 }, select: { rangoObjetivoMin: true, rangoObjetivoMax: true },
      });
      const { probAcierto, enRangoObjetivo } = evaluarAsignacion(d.thetaAntes, d.dificultadB, rangoDesdeConfig(cfg));
      // Nivel vigente DESPUÉS de la respuesta (puede cambiar si se creó el progreso del tema).
      const nivelDespues = d.temaId != null ? await this.adaptatividad.nivelDeTema(usuarioId, d.temaId) : null;

      await this.prisma.logAdaptacion.create({
        data: {
          usuarioId,
          temaId: d.temaId,
          ejercicioId: d.ejercicioId,
          thetaAntes: d.thetaAntes,
          thetaDespues: d.thetaDespues,
          dificultadB: d.dificultadB,
          probAcierto,
          nivelAntes: d.nivelAntes,
          nivelDespues,
          enRangoObjetivo,
          personalizado: d.personalizado,
          correcto: d.correcto,
          latenciaMs: d.latenciaMs,
          tiempoRespuestaMs,
        },
      });
    } catch (e) {
      this.logger.warn(`No se pudo registrar el log de adaptación: ${e instanceof Error ? e.message : e}`);
    }
  }
}
