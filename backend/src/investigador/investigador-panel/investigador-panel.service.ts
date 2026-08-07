import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  DOMINIO_DEMO, INSTITUCION_DEMO, MODO_DEMO, SOLO_ESTUDIANTES_DEL_ESTUDIO,
} from '../investigador-exportacion/investigador-exportacion.service';

/**
 * Panel del estudio (rol investigador, SOLO LECTURA): resumen de la muestra
 * (n total, control/experimental, desglose por institución), avance de la
 * recolección (pretest/postest/intervención) y fechas. Todo desde datos reales.
 */
@Injectable()
export class InvestigadorPanelService {
  constructor(private readonly prisma: PrismaService) {}

  async resumen() {
    const [estudiantes, evaluaciones, primerIntento, ultimoIntento, cuentasDemo] = await Promise.all([
      this.prisma.usuario.findMany({
        where: SOLO_ESTUDIANTES_DEL_ESTUDIO,
        select: { id: true, grupo: true, institucion: true, creadoEn: true },
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
    const control = estudiantes.filter((e) => e.grupo === 'control').length;
    const experimental = estudiantes.filter((e) => e.grupo === 'experimental').length;

    // Desglose por institución (control/experimental).
    const porInst = new Map<string, { total: number; control: number; experimental: number }>();
    for (const e of estudiantes) {
      const inst = e.institucion ?? 'Sin institución';
      const acc = porInst.get(inst) ?? { total: 0, control: 0, experimental: 0 };
      acc.total++; acc[e.grupo]++;
      porInst.set(inst, acc);
    }
    const instituciones = [...porInst.entries()]
      .map(([institucion, v]) => ({ institucion, ...v }))
      .sort((a, b) => b.total - a.total);

    // Avance de la recolección.
    const conPre = new Set<number>();
    const conPost = new Set<number>();
    for (const ev of evaluaciones) {
      if (ev.tipo === 'pre') conPre.add(ev.usuarioId);
      else conPost.add(ev.usuarioId);
    }
    const completaronIntervencion = [...conPost].filter((id) => conPre.has(id)).length;

    // Fechas de la recolección (mínimo registro real → último).
    const fechasEval = evaluaciones.map((e) => e.fecha.getTime());
    const fechasCreado = estudiantes.map((e) => e.creadoEn.getTime());
    const candidatosInicio = [...fechasCreado, ...(primerIntento ? [primerIntento.fecha.getTime()] : [])];
    const candidatosFin = [...fechasEval, ...(ultimoIntento ? [ultimoIntento.fecha.getTime()] : [])];

    return {
      muestra: { total, control, experimental },
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
      instituciones,
      avance: {
        con_pretest: conPre.size,
        con_postest: conPost.size,
        completaron_intervencion: completaronIntervencion,
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
