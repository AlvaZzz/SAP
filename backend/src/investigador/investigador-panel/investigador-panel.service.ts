import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Panel del estudio (rol investigador, SOLO LECTURA): resumen de la muestra
 * (n total, control/experimental, desglose por institución), avance de la
 * recolección (pretest/postest/intervención) y fechas. Todo desde datos reales.
 */
@Injectable()
export class InvestigadorPanelService {
  constructor(private readonly prisma: PrismaService) {}

  async resumen() {
    const [estudiantes, evaluaciones, primerIntento, ultimoIntento] = await Promise.all([
      this.prisma.usuario.findMany({
        where: { rol: 'estudiante' },
        select: { id: true, grupo: true, institucion: true, creadoEn: true },
      }),
      this.prisma.evaluacion.findMany({ select: { usuarioId: true, tipo: true, fecha: true } }),
      this.prisma.intento.findFirst({ orderBy: { fecha: 'asc' }, select: { fecha: true } }),
      this.prisma.intento.findFirst({ orderBy: { fecha: 'desc' }, select: { fecha: true } }),
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
