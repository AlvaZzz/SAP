import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  DOMINIO_DEMO, INSTITUCION_DEMO, MODO_DEMO, SOLO_ESTUDIANTES_DEL_ESTUDIO,
} from '../investigador-exportacion/investigador-exportacion.service';

/**
 * Panel del estudio (rol investigador, SOLO LECTURA): resumen de la muestra
 * (n total, desglose por paralelo), avance (diagnóstico inicial, uso real,
 * evaluación final) y período de uso. Todo desde datos reales.
 */
@Injectable()
export class InvestigadorPanelService {
  constructor(private readonly prisma: PrismaService) {}

  async resumen() {
    const [estudiantes, evaluaciones, primerIntento, ultimoIntento, cuentasDemo] = await Promise.all([
      this.prisma.usuario.findMany({
        where: SOLO_ESTUDIANTES_DEL_ESTUDIO,
        select: { id: true, paralelo: true, creadoEn: true },
      }),
      this.prisma.evaluacion.findMany({ select: { usuarioId: true, tipo: true, fecha: true } }),
      this.prisma.intento.findFirst({ orderBy: { fecha: 'asc' }, select: { fecha: true } }),
      this.prisma.intento.findFirst({ orderBy: { fecha: 'desc' }, select: { fecha: true } }),
      // CANDADO 3: transparencia. Se cuentan las cuentas de demostración para
      // avisarlo en pantalla. Nada oculto: quien mire el panel debe saber que
      // existen y que están fuera de todos los cálculos del estudio.
      this.prisma.usuario.count({
        where: {
          rol: 'estudiante',
          OR: [{ email: { endsWith: DOMINIO_DEMO } }, { institucion: INSTITUCION_DEMO }],
        },
      }),
    ]);

    const total = estudiantes.length;

    // Desglose por paralelo.
    const porParalelo = new Map<string, number>();
    for (const e of estudiantes) {
      const p = e.paralelo ?? 'Sin paralelo';
      porParalelo.set(p, (porParalelo.get(p) ?? 0) + 1);
    }
    const paralelos = [...porParalelo.entries()]
      .map(([paralelo, total]) => ({ paralelo, total }))
      .sort((a, b) => a.paralelo.localeCompare(b.paralelo));

    // Avance de la recolección.
    const conPre = new Set<number>();
    const conPost = new Set<number>();
    for (const ev of evaluaciones) {
      if (ev.tipo === 'pre') conPre.add(ev.usuarioId);
      else conPost.add(ev.usuarioId);
    }

    // Fechas de la recolección (mínimo registro real → último).
    const fechasEval = evaluaciones.map((e) => e.fecha.getTime());
    const fechasCreado = estudiantes.map((e) => e.creadoEn.getTime());
    const candidatosInicio = [...fechasCreado, ...(primerIntento ? [primerIntento.fecha.getTime()] : [])];
    const candidatosFin = [...fechasEval, ...(ultimoIntento ? [ultimoIntento.fecha.getTime()] : [])];

    return {
      muestra: { total, paralelos: paralelos.length },
      // CANDADO 3 de 3: visibilidad explícita de las cuentas sintéticas.
      demo: {
        cuentas: cuentasDemo,
        modo_demo: MODO_DEMO,
        aviso: cuentasDemo === 0
          ? null
          : MODO_DEMO
            // Modo demostración ACTIVO: las cifras de pantalla incluyen datos
            // sintéticos. El aviso tiene que ser imposible de pasar por alto.
            ? `⚠ MODO DEMOSTRACIÓN ACTIVO. Los datos que ves en TODAS las pantallas del investigador ` +
              `INCLUYEN ${cuentasDemo} cuenta${cuentasDemo === 1 ? '' : 's'} sintética${cuentasDemo === 1 ? '' : 's'}. ` +
              'NADA de lo que se muestre aquí son resultados de la investigación, y ninguna captura de ' +
              'esta pantalla puede presentarse como tal. Para volver al estudio real, quita la variable ' +
              'de entorno PREXI_MODO_DEMO y reinicia el backend.'
            : `Hay ${cuentasDemo} cuenta${cuentasDemo === 1 ? '' : 's'} de demostración en la base. ` +
              'Son datos SINTÉTICOS para probar y demostrar el sistema, no participantes de la ' +
              'investigación: están excluidas de todos los cálculos del estudio y de las exportaciones. ' +
              'Se identifican por el dominio @demo.prexi.local y por institución DEMO.',
      },
      paralelos,
      avance: {
        con_pretest: conPre.size,
        con_postest: conPost.size,
        pct_pretest: total ? Math.round((conPre.size / total) * 100) : 0,
        pct_postest: total ? Math.round((conPost.size / total) * 100) : 0,
      },
      recoleccion: {
        inicio: candidatosInicio.length ? new Date(Math.min(...candidatosInicio)) : null,
        fin: candidatosFin.length ? new Date(Math.max(...candidatosFin)) : null,
      },
    };
  }
}
