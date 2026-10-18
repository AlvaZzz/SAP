import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AdminAuditoriaService } from '../admin-auditoria/admin-auditoria.service';

/**
 * CURSOS (materias y paralelos) vistos por el administrador. Lo que más importa
 * aquí es que cada paralelo tenga DOCENTE: sin él nadie acepta las solicitudes
 * de inscripción de sus estudiantes ni los sigue. El admin asigna o cambia el
 * docente, y crea materias y paralelos. Todo queda en auditoría.
 */
@Injectable()
export class AdminCursosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AdminAuditoriaService,
  ) {}

  async listar() {
    const [materias, docentes, porParalelo] = await Promise.all([
      this.prisma.materia.findMany({
        orderBy: [{ gestion: 'desc' }, { nombre: 'asc' }],
        include: {
          paralelos: {
            orderBy: { nombre: 'asc' },
            include: { docente: { select: { id: true, nombre: true, email: true, activo: true } } },
          },
        },
      }),
      this.prisma.usuario.findMany({
        where: { rol: { in: ['docente', 'admin'] } },
        orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
        select: { id: true, nombre: true, email: true, rol: true, activo: true, _count: { select: { paralelosACargo: true } } },
      }),
      this.prisma.usuario.groupBy({
        by: ['paraleloId', 'estadoInscripcion'],
        where: { rol: 'estudiante', paraleloId: { not: null } },
        _count: { _all: true },
      }),
    ]);
    const cuenta = (paraleloId: number, estado: 'aprobada' | 'pendiente') =>
      porParalelo.find((g) => g.paraleloId === paraleloId && g.estadoInscripcion === estado)?._count._all ?? 0;

    const lista = materias.map((m) => ({
      id: m.id, nombre: m.nombre, sigla: m.sigla, gestion: m.gestion,
      paralelos: m.paralelos.map((p) => ({
        id: p.id, nombre: p.nombre,
        docente: p.docente ? { id: p.docente.id, nombre: p.docente.nombre, email: p.docente.email, activo: p.docente.activo } : null,
        estudiantes: cuenta(p.id, 'aprobada'),
        solicitudes: cuenta(p.id, 'pendiente'),
      })),
    }));
    const paralelos = lista.flatMap((m) => m.paralelos);
    return {
      materias: lista,
      docentes: docentes.map((d) => ({ id: d.id, nombre: d.nombre, email: d.email, rol: d.rol, activo: d.activo, paralelos: d._count.paralelosACargo })),
      resumen: {
        materias: lista.length,
        paralelos: paralelos.length,
        sin_docente: paralelos.filter((p) => !p.docente).length,
        estudiantes: paralelos.reduce((s, p) => s + p.estudiantes, 0),
        solicitudes: paralelos.reduce((s, p) => s + p.solicitudes, 0),
      },
    };
  }

  /** Asigna (o quita, con null) el docente de un paralelo. */
  async asignarDocente(actorId: number, paraleloId: number, docenteId: number | null) {
    const p = await this.prisma.paralelo.findUnique({ where: { id: paraleloId }, include: { materia: true, docente: { select: { nombre: true } } } });
    if (!p) throw new NotFoundException('Paralelo no encontrado');
    let nombreNuevo = 'sin docente';
    if (docenteId !== null) {
      const d = await this.prisma.usuario.findUnique({ where: { id: docenteId }, select: { nombre: true, rol: true, activo: true } });
      if (!d || !['docente', 'admin'].includes(d.rol)) throw new BadRequestException('Elige una cuenta con rol docente.');
      if (!d.activo) throw new BadRequestException('Esa cuenta está desactivada. Actívala primero en Usuarios.');
      nombreNuevo = d.nombre;
    }
    await this.prisma.paralelo.update({ where: { id: paraleloId }, data: { docenteId } });
    await this.auditoria.registrar({
      actorId, accion: 'paralelo_docente', entidad: 'paralelo', entidadId: paraleloId,
      detalle: `${p.materia.nombre} ${p.materia.gestion}, paralelo ${p.nombre}: ${p.docente?.nombre ?? 'sin docente'} → ${nombreNuevo}`,
    });
    return { ok: true };
  }

  async crearMateria(actorId: number, dto: { nombre: string; sigla?: string; gestion: string }) {
    const nombre = dto.nombre?.trim();
    const gestion = dto.gestion?.trim();
    if (!nombre || nombre.length < 3) throw new BadRequestException('Escribe el nombre de la materia.');
    if (!/^\d{4}-(I|II|III|IV|V)$/i.test(gestion ?? '')) throw new BadRequestException('La gestión va como 2026-I o 2026-II.');
    const existe = await this.prisma.materia.findUnique({ where: { nombre_gestion: { nombre, gestion: gestion.toUpperCase() } } });
    if (existe) throw new ConflictException('Esa materia ya existe en esa gestión.');
    const m = await this.prisma.materia.create({ data: { nombre, sigla: dto.sigla?.trim() || null, gestion: gestion.toUpperCase() } });
    await this.auditoria.registrar({ actorId, accion: 'materia_crear', entidad: 'materia', entidadId: m.id, detalle: `Creó la materia ${m.nombre} (${m.gestion})` });
    return { id: m.id };
  }

  async crearParalelo(actorId: number, dto: { materiaId: number; nombre: string; docenteId?: number | null }) {
    const m = await this.prisma.materia.findUnique({ where: { id: dto.materiaId } });
    if (!m) throw new NotFoundException('Materia no encontrada');
    const nombre = String(dto.nombre ?? '').trim().toUpperCase().replace(/^PAR(ALELO)?\.?\s*/, '');
    if (!/^[A-Z0-9]{1,4}$/.test(nombre)) throw new BadRequestException('El paralelo es una letra o un número corto (A, B, 1…).');
    const existe = await this.prisma.paralelo.findUnique({ where: { materiaId_nombre: { materiaId: m.id, nombre } } });
    if (existe) throw new ConflictException(`El paralelo ${nombre} ya existe en esa materia.`);
    const p = await this.prisma.paralelo.create({ data: { materiaId: m.id, nombre, docenteId: null } });
    await this.auditoria.registrar({ actorId, accion: 'paralelo_crear', entidad: 'paralelo', entidadId: p.id, detalle: `Creó el paralelo ${nombre} de ${m.nombre} (${m.gestion})` });
    if (dto.docenteId) await this.asignarDocente(actorId, p.id, dto.docenteId);
    return { id: p.id };
  }
}
