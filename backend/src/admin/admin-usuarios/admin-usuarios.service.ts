import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma, Rol } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AdminAuditoriaService } from '../admin-auditoria/admin-auditoria.service';
import { CrearUsuarioDto, EditarUsuarioDto } from './dto/usuario.dto';
import { errorNombreCompleto, usuarioDeAcceso } from '../../common/usuario/usuario-acceso';
import { capitalizar, limpiarCi, nombreCompletoDe } from '../../docente/docente-registro/lista';

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
    // "Alvaro_12929098" (usuario de un estudiante) se busca por su CI.
    const q = filtros.q?.trim();
    const ciDeUsuario = q?.match(/_([0-9A-Za-z-]{4,20})$/)?.[1]?.toUpperCase();
    const where: Prisma.UsuarioWhereInput = {
      ...(filtros.rol ? { rol: filtros.rol as Rol } : {}),
      ...(filtros.estado === 'activo' ? { activo: true }
        : filtros.estado === 'inactivo' ? { activo: false }
          : filtros.estado === 'bloqueado' ? { lockedUntil: { gt: new Date() } }
            : filtros.estado === 'temporal' ? { mustChangePassword: true } : {}),
      ...(q
        ? {
            OR: [
              { nombre: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              { cedula: { contains: ciDeUsuario ?? q, mode: 'insensitive' } },
              { ru: { contains: q } },
            ],
          }
        : {}),
    };
    const usuarios = await this.prisma.usuario.findMany({
      where,
      orderBy: [{ activo: 'desc' }, { creadoEn: 'desc' }],
      select: {
        id: true, nombre: true, apellidoPaterno: true, apellidoMaterno: true, nombres: true, email: true, cedula: true, ru: true, rol: true, carrera: true,
        institucion: true, paralelo: true, activo: true, creadoEn: true, mustChangePassword: true, lockedUntil: true,
        estadoInscripcion: true,
        paraleloRef: { select: { nombre: true, materia: { select: { nombre: true, gestion: true } } } },
        _count: { select: { paralelosACargo: true } },
      },
    });
    const ahora = new Date();
    return usuarios.map(({ lockedUntil, paraleloRef, _count, ...u }) => ({
      ...u,
      // Usuario para entrar (PrimerNombre_CI), igual para todos los roles.
      usuario: usuarioDeAcceso(u) || u.email || null,
      bloqueado: !!lockedUntil && lockedUntil > ahora,
      curso: paraleloRef ? `${paraleloRef.materia.nombre} ${paraleloRef.materia.gestion} · ${paraleloRef.nombre}` : null,
      paralelos_a_cargo: _count.paralelosACargo,
    }));
  }

  /** Conteo por rol (para el dashboard y encabezados). */
  async conteos() {
    const grupos = await this.prisma.usuario.groupBy({ by: ['rol'], _count: { _all: true } });
    const porRol: Record<string, number> = { estudiante: 0, docente: 0, investigador: 0, admin: 0 };
    for (const g of grupos) porRol[g.rol] = g._count._all;
    return porRol;
  }

  async crear(actorId: number, dto: CrearUsuarioDto) {
    const cedula = limpiarCi(dto.cedula);
    if (!/^\d{5,10}(-?[0-9A-Z]{1,3})?$/.test(cedula)) throw new BadRequestException('El CI debe tener entre 5 y 10 dígitos.');
    if (await this.prisma.usuario.findUnique({ where: { cedula } }))
      throw new BadRequestException('Ya existe una cuenta con ese CI.');
    const email = dto.email?.trim().toLowerCase() || null;
    if (email && await this.prisma.usuario.findUnique({ where: { email } }))
      throw new BadRequestException('Ya existe una cuenta con ese correo.');

    const apellidoPaterno = capitalizar(dto.apellidoPaterno);
    const apellidoMaterno = dto.apellidoMaterno?.trim() ? capitalizar(dto.apellidoMaterno) : null;
    const nombres = capitalizar(dto.nombres);
    const errorNombre = errorNombreCompleto({ apellidoPaterno, apellidoMaterno, nombres });
    if (errorNombre) throw new BadRequestException(errorNombre);
    const nombre = nombreCompletoDe({ apellidoPaterno, apellidoMaterno: apellidoMaterno ?? '', nombres });
    const usuarioAcceso = usuarioDeAcceso({ nombres, cedula });

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const usuario = await this.prisma.usuario.create({
      data: {
        nombre, apellidoPaterno, apellidoMaterno, nombres, email, cedula, rol: dto.rol,
        carrera: dto.carrera ?? null, institucion: dto.institucion ?? null, passwordHash,
        // La contraseña la eligió el admin: la persona debe cambiarla al entrar.
        mustChangePassword: true,
        // Los estudiantes deben rendir el pretest; los demás roles no.
        pretestCompletado: dto.rol !== 'estudiante',
        // Ranking solo tiene sentido para estudiantes (gamificación).
        ...(dto.rol === 'estudiante' ? { ranking: { create: { xpTotal: 0, rachaDias: 0 } } } : {}),
      },
      select: { id: true, nombre: true, rol: true },
    });
    await this.auditoria.registrar({
      actorId, accion: 'usuario_crear', entidad: 'usuario', entidadId: usuario.id,
      detalle: `Creó a ${usuario.nombre} (usuario ${usuarioAcceso}) con rol ${dto.rol}`,
    });
    return { id: usuario.id, usuario: usuarioAcceso };
  }

  private async existente(id: number) {
    const u = await this.prisma.usuario.findUnique({ where: { id } });
    if (!u) throw new NotFoundException('Usuario no encontrado');
    return u;
  }

  async editar(actorId: number, id: number, dto: EditarUsuarioDto) {
    const u = await this.existente(id);

    const email = dto.email !== undefined ? (dto.email.trim().toLowerCase() || null) : undefined;
    if (email && email !== u.email) {
      const otro = await this.prisma.usuario.findUnique({ where: { email } });
      if (otro) throw new BadRequestException('Ya existe una cuenta con ese correo.');
    }
    const cedula = dto.cedula !== undefined ? limpiarCi(dto.cedula) : undefined;
    if (cedula !== undefined) {
      if (!/^\d{5,10}(-?[0-9A-Z]{1,3})?$/.test(cedula)) throw new BadRequestException('El CI debe tener entre 5 y 10 dígitos.');
      if (cedula !== u.cedula && await this.prisma.usuario.findUnique({ where: { cedula } }))
        throw new BadRequestException('Ya existe una cuenta con ese CI.');
    }
    // No permitir que el admin se quite a sí mismo el rol admin (evita quedar sin admins).
    if (id === actorId && dto.rol && dto.rol !== 'admin')
      throw new ForbiddenException('No puedes cambiar tu propio rol de administrador');

    // Apellidos y nombres por separado (de ahí sale el usuario); el nombre completo se arma solo.
    const nombreData: Prisma.UsuarioUpdateInput = {};
    if (dto.apellidoPaterno !== undefined || dto.nombres !== undefined || dto.apellidoMaterno !== undefined) {
      const apellidoPaterno = capitalizar(dto.apellidoPaterno ?? u.apellidoPaterno ?? '');
      const apellidoMaterno = capitalizar(dto.apellidoMaterno ?? u.apellidoMaterno ?? '');
      const nombres = capitalizar(dto.nombres ?? u.nombres ?? '');
      if (!apellidoPaterno || !nombres) throw new BadRequestException('El apellido paterno y los nombres son obligatorios.');
      const errorNombre = errorNombreCompleto({ apellidoPaterno, apellidoMaterno, nombres });
      if (errorNombre) throw new BadRequestException(errorNombre);
      Object.assign(nombreData, { apellidoPaterno, apellidoMaterno: apellidoMaterno || null, nombres, nombre: nombreCompletoDe({ apellidoPaterno, apellidoMaterno, nombres }) });
    } else if (dto.nombre !== undefined) {
      nombreData.nombre = dto.nombre;
    }

    const cambioRol = dto.rol && dto.rol !== u.rol;
    await this.prisma.usuario.update({
      where: { id },
      data: {
        ...nombreData,
        ...(email !== undefined ? { email } : {}),
        ...(cedula !== undefined ? { cedula } : {}),
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
