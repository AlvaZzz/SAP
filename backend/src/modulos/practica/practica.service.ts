import { Injectable, BadRequestException } from '@nestjs/common';
import { ContextoCodigo } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TutorIaService } from '../../tutor-ia/tutor-ia.service';


@Injectable()
export class PracticaService {
  constructor(
    private readonly prisma: PrismaService,
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

  /**
   * Guarda el código y la ÚLTIMA SALIDA que produjo el navegador.
   *
   * La ejecución dejó de ocurrir aquí: ahora corre en el cliente con Pyodide
   * (ver frontend/src/lib/python-runtime.ts). Este método solo persiste, para no
   * perder la función de "retomar donde lo dejaste" que ya existía.
   */
  async guardarEjecucion(usuarioId: number, codigo: string, salida: string, contexto: ContextoCodigo, refId?: number) {
    const existe = await this.prisma.codigoPractica.findFirst({ where: { usuarioId, contexto, refId: refId ?? null } });
    if (existe) {
      await this.prisma.codigoPractica.update({ where: { id: existe.id }, data: { codigo, ultimaSalida: salida } });
    } else {
      await this.prisma.codigoPractica.create({ data: { usuarioId, contexto, refId: refId ?? null, codigo, ultimaSalida: salida } });
    }
    return { ok: true };
  }

  /** PREXI revisa el código actual y guía sin resolver. */
  asistir(codigo: string, enunciado?: string, pregunta?: string) {
    return this.tutor.asistirCodigo({ codigo, enunciado, pregunta }).then((respuesta) => ({ respuesta }));
  }

  /**
   * AUTOCOMPROBACIÓN de un reto autocalificable.
   *
   * OJO — cambio deliberado: ya NO otorga XP ni emblemas. La ejecución pasó al
   * navegador (Pyodide), así que el servidor no puede verificar nada por sí mismo:
   * solo puede comparar la salida que le REPORTA el cliente, y eso es falsificable
   * desde las DevTools. Premiar con XP algo que el alumno puede fabricar
   * corrompería el ranking, el desempeño y los datos del estudio.
   *
   * Queda como comprobación honesta para el estudiante ("¿coincide mi salida?");
   * el XP de estos retos se otorga por la vía de revisión del docente
   * (POST /retos/:id/entregar), que ya existía.
   */
  async comprobarReto(retoId: number, salidaCliente: string) {
    const reto = await this.prisma.reto.findFirst({
      where: { id: retoId, activo: true },
      select: { id: true, esBugHunt: true, autoCalificable: true, ejemploSalida: true },
    });
    if (!reto) throw new BadRequestException('El reto no existe o no está disponible');
    if (!reto.esBugHunt && !reto.autoCalificable) {
      throw new BadRequestException('Este reto lo revisa tu docente; usa "Entregar reto".');
    }
    if (!reto.ejemploSalida) throw new BadRequestException('Este reto no tiene salida esperada configurada.');

    const correcto = (salidaCliente ?? '').trim() === reto.ejemploSalida.trim();
    return {
      correcto,
      salida: salidaCliente ?? '',
      esperado: reto.ejemploSalida,
      // Se conservan los campos para no romper el contrato del cliente.
      xp: 0,
      emblemas_nuevos: [] as { clave: string; nombre: string; descripcion: string; svgKey: string; icono: string }[],
    };
  }
}
