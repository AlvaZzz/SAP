import { Injectable } from '@nestjs/common';
import { ContextoCodigo } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PistonService } from './piston.service';
import { TutorIaService } from '../../tutor-ia/tutor-ia.service';

@Injectable()
export class PracticaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly piston: PistonService,
    private readonly tutor: TutorIaService,
  ) {}

  async cargarCodigo(usuarioId: number, contexto: ContextoCodigo, refId?: number) {
    return this.prisma.codigoPractica.findFirst({
      where: { usuarioId, contexto, refId: refId ?? null },
      orderBy: { actualizadoEn: 'desc' },
    });
  }

  async guardarCodigo(usuarioId: number, contexto: ContextoCodigo, codigo: string, refId?: number) {
    const existe = await this.prisma.codigoPractica.findFirst({
      where: { usuarioId, contexto, refId: refId ?? null },
    });
    if (existe) {
      return this.prisma.codigoPractica.update({ where: { id: existe.id }, data: { codigo } });
    }
    return this.prisma.codigoPractica.create({ data: { usuarioId, contexto, refId: refId ?? null, codigo } });
  }

  /** Ejecuta el código en el sandbox Piston y guarda la última salida. */
  async ejecutar(usuarioId: number, codigo: string, contexto: ContextoCodigo, refId?: number, stdin = '') {
    const resultado = await this.piston.ejecutar(codigo, stdin);
    const salida = resultado.ok ? resultado.stdout : resultado.stderr || resultado.stdout;

    // Persiste el código y su última salida (mejor esfuerzo).
    const existe = await this.prisma.codigoPractica.findFirst({ where: { usuarioId, contexto, refId: refId ?? null } });
    if (existe) await this.prisma.codigoPractica.update({ where: { id: existe.id }, data: { codigo, ultimaSalida: salida } });
    else await this.prisma.codigoPractica.create({ data: { usuarioId, contexto, refId: refId ?? null, codigo, ultimaSalida: salida } });

    return resultado;
  }

  /** ALVARO revisa el código actual y guía sin resolver. */
  asistir(codigo: string, enunciado?: string, pregunta?: string) {
    return this.tutor.asistirCodigo({ codigo, enunciado, pregunta }).then((respuesta) => ({ respuesta }));
  }
}
