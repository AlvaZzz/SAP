import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/** Una unidad con su introducción teórica didáctica (pestaña de la fase previa). */
export interface UnidadIntroduccion {
  id: number;
  numero: number;
  titulo: string;
  descripcion: string | null;
  introduccion: string | null;
}

/**
 * Fase de INTRODUCCIÓN didáctica previa al diagnóstico (rol estudiante). Sirve el
 * contenido teórico por unidad (editado por el docente) y gestiona el gate: el
 * pretest solo se habilita cuando el estudiante marca la introducción como leída.
 */
@Injectable()
export class IntroduccionService {
  constructor(private readonly prisma: PrismaService) {}

  /** Las 5 unidades del plan, ordenadas, con su introducción (una por pestaña). */
  async unidades(): Promise<UnidadIntroduccion[]> {
    const unidades = await this.prisma.unidad.findMany({
      orderBy: [{ orden: 'asc' }, { numero: 'asc' }],
      select: { id: true, numero: true, titulo: true, descripcion: true, introduccion: true },
    });
    return unidades;
  }

  async estado(usuarioId: number): Promise<{ completada: boolean }> {
    const u = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { introduccionCompletada: true },
    });
    return { completada: !!u?.introduccionCompletada };
  }

  /** Marca la introducción como revisada → habilita el diagnóstico. Idempotente. */
  async completar(usuarioId: number): Promise<{ completada: boolean }> {
    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { introduccionCompletada: true },
    });
    return { completada: true };
  }
}
