import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AdminAuditoriaService } from '../admin-auditoria/admin-auditoria.service';
import { ActualizarConfigDto } from './dto/config.dto';

/**
 * Configuración central del sistema (rol admin). Fila única id=1. Es la ÚNICA
 * fuente de parámetros: estudiante, docente e IA leen desde aquí. El admin la
 * edita; cada cambio queda auditado con las claves modificadas.
 */
@Injectable()
export class AdminConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AdminAuditoriaService,
  ) {}

  /** Devuelve la config (la crea con defaults si aún no existe). */
  async obtener() {
    const existe = await this.prisma.configuracionSistema.findUnique({ where: { id: 1 } });
    if (existe) return existe;
    return this.prisma.configuracionSistema.create({ data: { id: 1 } });
  }

  async actualizar(actorId: number, dto: ActualizarConfigDto) {
    await this.obtener(); // garantiza que la fila exista
    const data = Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined));
    const cambiadas = Object.keys(data);
    if (cambiadas.length === 0) return this.obtener();

    const actualizada = await this.prisma.configuracionSistema.update({ where: { id: 1 }, data });
    await this.auditoria.registrar({
      actorId, accion: 'config_cambiar', entidad: 'configuracion', entidadId: 1,
      detalle: `Actualizó la configuración: ${cambiadas.join(', ')}`,
    });
    return actualizada;
  }
}
