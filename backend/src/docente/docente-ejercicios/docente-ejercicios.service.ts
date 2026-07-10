import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CrearEjercicioDto, EditarEjercicioDto } from './dto/ejercicio.dto';
import { nivelDesdeEstrellas } from '../../common/niveles/nivel-dificultad';
import { dificultadDesdeEstrellas } from '../../mediciones/irt/irt';

/**
 * Gestión de ejercicios (rol docente). CRUD del banco de práctica (5 niveles).
 * ENGANCHE: lo que aquí se crea/edita/activa aparece de inmediato en el módulo
 * de ejercicios del estudiante, que consulta `banco = practica AND activo`.
 */
@Injectable()
export class DocenteEjerciciosService {
  constructor(private readonly prisma: PrismaService) {}

  /** Traduce número de nivel (1-5) al id real del nivel. */
  private async nivelId(numero: number): Promise<number> {
    const nivel = await this.prisma.nivel.findUnique({ where: { numero } });
    if (!nivel) throw new BadRequestException(`No existe el nivel ${numero}`);
    return nivel.id;
  }

  async listar(filtros: { nivel?: number; categoria?: string; dificultad?: number; temaId?: number }) {
    const where: Prisma.EjercicioWhereInput = {
      banco: 'practica',
      ...(filtros.nivel ? { nivel: { numero: filtros.nivel } } : {}),
      ...(filtros.categoria ? { categoria: filtros.categoria } : {}),
      ...(filtros.dificultad ? { estrellas: filtros.dificultad } : {}),
      ...(filtros.temaId ? { temaId: filtros.temaId } : {}),
    };
    const ejercicios = await this.prisma.ejercicio.findMany({
      where,
      orderBy: [{ nivelId: 'asc' }, { id: 'asc' }],
      include: {
        nivel: { select: { numero: true, titulo: true } },
        tema: { select: { numero: true, titulo: true } },
        _count: { select: { intentos: true } },
      },
    });
    return ejercicios.map((e) => this.aVista(e));
  }

  /** Categorías existentes (para poblar el filtro del frontend). */
  async categorias(): Promise<string[]> {
    const rows = await this.prisma.ejercicio.findMany({
      where: { banco: 'practica' },
      distinct: ['categoria'],
      select: { categoria: true },
      orderBy: { categoria: 'asc' },
    });
    return rows.map((r) => r.categoria);
  }

  async detalle(id: number) {
    const e = await this.prisma.ejercicio.findFirst({
      where: { id, banco: 'practica' },
      include: { nivel: { select: { numero: true, titulo: true } }, tema: { select: { numero: true, titulo: true } }, _count: { select: { intentos: true } } },
    });
    if (!e) throw new NotFoundException('Ejercicio no encontrado');
    return this.aVista(e);
  }

  async crear(dto: CrearEjercicioDto) {
    const nivelId = await this.nivelId(dto.nivel);
    const e = await this.prisma.ejercicio.create({
      data: {
        titulo: dto.titulo,
        categoria: dto.categoria,
        nivelId,
        temaId: dto.temaId ?? null,
        estrellas: dto.estrellas,
        // Clasificación adaptativa y dificultad b (IRT/Rasch) derivadas de las
        // estrellas, para que el contenido docente participe en la adaptatividad.
        nivelDificultad: nivelDesdeEstrellas(dto.estrellas),
        dificultadB: dificultadDesdeEstrellas(dto.estrellas),
        tipo: dto.tipo,
        enunciado: dto.enunciado,
        codigoPython: dto.codigoPython ?? null,
        opciones: (dto.opciones ?? []) as unknown as Prisma.InputJsonValue,
        respuestaCorrecta: dto.respuestaCorrecta,
        xp: dto.xp,
        explicacionIa: dto.explicacionIa ?? null,
        activo: dto.activo ?? true,
        banco: 'practica',
      },
      include: { nivel: { select: { numero: true, titulo: true } }, tema: { select: { numero: true, titulo: true } }, _count: { select: { intentos: true } } },
    });
    return this.aVista(e);
  }

  async editar(id: number, dto: EditarEjercicioDto) {
    await this.detalle(id); // 404 si no existe / no es de práctica
    const data: Prisma.EjercicioUpdateInput = {
      ...(dto.titulo !== undefined ? { titulo: dto.titulo } : {}),
      ...(dto.categoria !== undefined ? { categoria: dto.categoria } : {}),
      ...(dto.nivel !== undefined ? { nivel: { connect: { id: await this.nivelId(dto.nivel) } } } : {}),
      ...(dto.temaId !== undefined ? { tema: dto.temaId ? { connect: { id: dto.temaId } } : { disconnect: true } } : {}),
      ...(dto.estrellas !== undefined
        ? {
            estrellas: dto.estrellas,
            // Reclasifica nivel y recalcula b (IRT) al cambiar las estrellas.
            nivelDificultad: nivelDesdeEstrellas(dto.estrellas),
            dificultadB: dificultadDesdeEstrellas(dto.estrellas),
          }
        : {}),
      ...(dto.tipo !== undefined ? { tipo: dto.tipo } : {}),
      ...(dto.enunciado !== undefined ? { enunciado: dto.enunciado } : {}),
      ...(dto.codigoPython !== undefined ? { codigoPython: dto.codigoPython } : {}),
      ...(dto.opciones !== undefined ? { opciones: dto.opciones as unknown as Prisma.InputJsonValue } : {}),
      ...(dto.respuestaCorrecta !== undefined ? { respuestaCorrecta: dto.respuestaCorrecta } : {}),
      ...(dto.xp !== undefined ? { xp: dto.xp } : {}),
      ...(dto.explicacionIa !== undefined ? { explicacionIa: dto.explicacionIa } : {}),
      ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
    };
    const e = await this.prisma.ejercicio.update({
      where: { id },
      data,
      include: { nivel: { select: { numero: true, titulo: true } }, tema: { select: { numero: true, titulo: true } }, _count: { select: { intentos: true } } },
    });
    return this.aVista(e);
  }

  async alternarActivo(id: number) {
    const actual = await this.detalle(id);
    return this.editar(id, { activo: !actual.activo });
  }

  async eliminar(id: number) {
    await this.detalle(id);
    await this.prisma.ejercicio.delete({ where: { id } });
    return { ok: true };
  }

  private aVista(e: Prisma.EjercicioGetPayload<{
    include: { nivel: { select: { numero: true; titulo: true } }; tema: { select: { numero: true; titulo: true } }; _count: { select: { intentos: true } } };
  }>) {
    return {
      id: e.id,
      titulo: e.titulo,
      categoria: e.categoria,
      nivel: e.nivel.numero,
      nivel_titulo: e.nivel.titulo,
      temaId: e.temaId,
      tema_numero: e.tema?.numero ?? null,
      tema_titulo: e.tema?.titulo ?? null,
      estrellas: e.estrellas,
      tipo: e.tipo,
      enunciado: e.enunciado,
      codigoPython: e.codigoPython,
      opciones: e.opciones,
      respuestaCorrecta: e.respuestaCorrecta,
      xp: e.xp,
      explicacionIa: e.explicacionIa,
      activo: e.activo,
      intentos: e._count.intentos,
      creadoEn: e.creadoEn,
    };
  }
}
