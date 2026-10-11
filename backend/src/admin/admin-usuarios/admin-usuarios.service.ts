import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma, Rol } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AdminAuditoriaService } from '../admin-auditoria/admin-auditoria.service';
import { CrearUsuarioDto, EditarUsuarioDto } from './dto/usuario.dto';

/**
 * Gestión de usuarios de TODOS los roles (rol admin). Preferimos desactivar
 * (soft-disable) sobre borrar, para no perder datos de investigación asociados.
 * El admin nunca ve contraseñas: solo puede forzar un reseteo. Toda acción
 * sensible queda en auditoría.
 */
@Injectable()
export class AdminUsuariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AdminAuditoriaService,
  ) {}

  async listar(filtros: { rol?: string; estado?: string; q?: string }) {
    const where: Prisma.UsuarioWhereInput = {
      ...(filtros.rol ? { rol: filtros.rol as Rol } : {}),
      ...(filtros.estado === 'activo' ? { activo: true } : filtros.estado === 'inactivo' ? { activo: false } : {}),
      ...(filtros.q
        ? { OR: [{ nombre: { contains: filtros.q, mode: 'insensitive' } }, { email: { contains: filtros.q, mode: 'insensitive' } }] }
        : {}),
    };
    const usuarios = await this.prisma.usuario.findMany({
      where,
      orderBy: [{ activo: 'desc' }, { creadoEn: 'desc' }],
      select: {
        id: true, nombre: true, email: true, cedula: true, rol: true, carrera: true,
        institucion: true, paralelo: true, activo: true, creadoEn: true,
      },
    });
    return usuarios;
  }

  /** Conteo por rol (para el dashboard y encabezados). */
  async conteos() {
    const grupos = await this.prisma.usuario.groupBy({ by: ['rol'], _count: { _all: true } });
    const porRol: Record<string, number> = { estudiante: 0, docente: 0, investigador: 0, admin: 0 };
    for (const g of grupos) porRol[g.rol] = g._count._all;
    return porRol;
  }

  async crear(actorId: number, dto: CrearUsuarioDto) {
    if (await this.prisma.usuario.findUnique({ where: { email: dto.email } }))
      throw new BadRequestException('Ya existe un usuario con ese correo');
    if (await this.prisma.usuario.findUnique({ where: { cedula: dto.cedula } }))
      throw new BadRequestException('Ya existe un usuario con esa cédula');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const usuario = await this.prisma.usuario.create({
      data: {
        nombre: dto.nombre, email: dto.email, cedula: dto.cedula, rol: dto.rol,
        carrera: dto.carrera ?? null, institucion: dto.institucion ?? null, passwordHash,
        // Los estudiantes deben rendir el pretest; los demás roles no.
        pretestCompletado: dto.rol !== 'estudiante',
        // Ranking solo tiene sentido para estudiantes (gamificación).
        ...(dto.rol === 'estudiante' ? { ranking: { create: { xpTotal: 0, rachaDias: 0 } } } : {}),
      },
      select: { id: true, nombre: true, rol: true },
    });
    await this.auditoria.registrar({
      actorId, accion: 'usuario_crear', entidad: 'usuario', entidadId: usuario.id,
      detalle: `Creó a ${usuario.nombre} (${dto.email}) con rol ${dto.rol}`,
    });
    return { id: usuario.id };
  }

  private async existente(id: number) {
    const u = await this.prisma.usuario.findUnique({ where: { id } });
    if (!u) throw new NotFoundException('Usuario no encontrado');
    return u;
  }

  async editar(actorId: number, id: number, dto: EditarUsuarioDto) {
    const u = await this.existente(id);

    if (dto.email && dto.email !== u.email) {
      const otro = await this.prisma.usuario.findUnique({ where: { email: dto.email } });
      if (otro) throw new BadRequestException('Ya existe un usuario con ese correo');
    }
    if (dto.cedula && dto.cedula !== u.cedula) {
      const otro = await this.prisma.usuario.findUnique({ where: { cedula: dto.cedula } });
      if (otro) throw new BadRequestException('Ya existe un usuario con esa cédula');
    }
    // No permitir que el admin se quite a sí mismo el rol admin (evita quedar sin admins).
    if (id === actorId && dto.rol && dto.rol !== 'admin')
      throw new ForbiddenException('No puedes cambiar tu propio rol de administrador');

    const cambioRol = dto.rol && dto.rol !== u.rol;
    await this.prisma.usuario.update({
      where: { id },
      data: {
        ...(dto.nombre !== undefined ? { nombre: dto.nombre } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.cedula !== undefined ? { cedula: dto.cedula } : {}),
        ...(dto.rol !== undefined ? { rol: dto.rol } : {}),
        ...(dto.carrera !== undefined ? { carrera: dto.carrera } : {}),
        ...(dto.institucion !== undefined ? { institucion: dto.institucion } : {}),
      },
    });

    await this.auditoria.registrar({
      actorId, accion: 'usuario_editar', entidad: 'usuario', entidadId: id,
      detalle: `Editó los datos de ${u.nombre}`,
    });
    if (cambioRol) {
      await this.auditoria.registrar({
        actorId, accion: 'rol_cambiar', entidad: 'usuario', entidadId: id,
        detalle: `Cambió el rol de ${u.nombre}: ${u.rol} → ${dto.rol}`,
      });
    }
    return { ok: true };
  }

  async alternarActivo(actorId: number, id: number) {
    const u = await this.existente(id);
    if (id === actorId) throw new ForbiddenException('No puedes desactivar tu propia cuenta');
    const nuevo = !u.activo;
    await this.prisma.usuario.update({ where: { id }, data: { activo: nuevo } });
    await this.auditoria.registrar({
      actorId, accion: 'usuario_estado', entidad: 'usuario', entidadId: id,
      detalle: `${nuevo ? 'Activó' : 'Desactivó'} la cuenta de ${u.nombre}`,
    });
    return { ok: true, activo: nuevo };
  }

  /**
   * Genera una contraseña temporal, la fuerza a cambiar en el próximo ingreso y
   * la devuelve UNA sola vez al admin (nunca se almacena en claro ni se audita).
   */
  async resetPassword(actorId: number, id: number) {
    const u = await this.existente(id);
    const temporal = this.generarPassword();
    const passwordHash = await bcrypt.hash(temporal, 10);
    await this.prisma.usuario.update({
      where: { id },
      data: { passwordHash, mustChangePassword: true, failedLoginCount: 0, lockedUntil: null },
    });
    await this.auditoria.registrar({
      actorId, accion: 'password_reset', entidad: 'usuario', entidadId: id,
      detalle: `Restableció la contraseña de ${u.nombre} (forzar cambio en el próximo ingreso)`,
    });
    return { ok: true, temporal };
  }

  private generarPassword(): string {
    const may = 'ABCDEFGHJKLMNPQRSTUVWXYZ', min = 'abcdefghijkmnpqrstuvwxyz', num = '23456789', sim = '@#$%&*';
    const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
    const base = [pick(may), pick(min), pick(num), pick(sim)];
    const todos = may + min + num;
    while (base.length < 10) base.push(pick(todos));
    return base.sort(() => Math.random() - 0.5).join('');
  }
}
