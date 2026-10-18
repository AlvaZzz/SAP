import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthService } from '../auth.service';
import { usuarioDeAcceso } from '../../common/usuario/usuario-acceso';

/** Horas que tiene la persona para poner su nueva contraseña después de que se la aprueban. */
export const HORAS_PARA_COMPLETAR = 24;
const hash = (s: string) => createHash('sha256').update(s).digest('hex');

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  RECUPERAR LA CONTRASEÑA SIN CORREO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  1. La persona escribe su usuario (Nombre_CI). Se crea una solicitud y se le
 *     devuelve un SECRETO que queda solo en su navegador (en la base, su hash).
 *  2. Se avisa por notificación a quien puede aprobarla: el docente de su
 *     paralelo si es estudiante; los administradores si es docente, si es otro
 *     rol o si su paralelo no tiene docente.
 *  3. Al aceptarla, el navegador que la pidió (con el secreto) muestra el
 *     formulario de nueva contraseña. Tiene 24 horas para hacerlo.
 *
 *  Sin el secreto nadie puede poner la contraseña, aunque la solicitud esté
 *  aprobada: aprobar solo confirma que es la persona correcta.
 * ═══════════════════════════════════════════════════════════════════════════
 */
@Injectable()
export class RecuperacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  // ── Lado de quien olvidó su contraseña (público) ──

  async solicitar(identificador: string) {
    const u = await this.auth.buscarCuenta(identificador ?? '');
    if (!u) throw new NotFoundException('No encontramos ese usuario. Revisa que sea tu primer nombre, un guion bajo y tu CI (ej. Alvaro_12929098).');
    if (!u.activo) throw new ForbiddenException('Tu cuenta está desactivada. Habla con tu docente o con el administrador.');

    const aprobadores = await this.aprobadoresDe(u.id);
    if (aprobadores.ids.length === 0) throw new BadRequestException('No hay nadie que pueda aprobar tu solicitud todavía. Habla con el administrador.');

    const secreto = randomBytes(32).toString('hex');
    const solicitud = await this.prisma.$transaction(async (tx) => {
      // Una sola solicitud viva por persona: la nueva reemplaza a las anteriores.
      await tx.solicitudRecuperacion.updateMany({
        where: { usuarioId: u.id, estado: { in: ['pendiente', 'aprobada'] } },
        data: { estado: 'cancelada', resueltoEn: new Date() },
      });
      return tx.solicitudRecuperacion.create({ data: { usuarioId: u.id, secretoHash: hash(secreto) } });
    });

    const usuario = usuarioDeAcceso(u) || u.email || u.nombre;
    try {
      await this.prisma.notificacion.createMany({
        data: aprobadores.ids.map((usuarioId) => ({
          usuarioId, tipo: 'recuperacion_contrasena', refId: solicitud.id,
          titulo: 'Pide recuperar su contraseña',
          mensaje: `${u.nombre} (${usuario}) olvidó su contraseña. Acéptalo si es quien dice ser.`,
          enlace: aprobadores.esAdmin ? '/admin/usuarios?ver=recuperaciones' : '/docente/estudiantes/registro?ver=solicitudes',
        })),
      });
    } catch { /* el aviso no debe impedir la solicitud */ }

    return { id: solicitud.id, secreto, nombre: primerNombreVisible(u), aprueba: aprobadores.descripcion };
  }

  /** En qué va la solicitud (lo consulta el navegador que la pidió). */
  async estado(id: number, secreto: string) {
    const s = await this.propia(id, secreto);
    const vencida = s.estado === 'aprobada' && this.vencida(s.resueltoEn);
    return {
      estado: vencida ? 'vencida' : s.estado,
      motivo: s.motivo,
      aprobador: s.aprobador?.nombre ?? null,
      nombre: primerNombreVisible(s.usuario),
      usuario: usuarioDeAcceso(s.usuario) || s.usuario.email || null,
    };
  }

  /** Pone la nueva contraseña (solo si su docente o un admin la aprobó). */
  async completar(id: number, secreto: string, nueva: string) {
    const s = await this.propia(id, secreto);
    if (s.estado !== 'aprobada') throw new BadRequestException('Tu solicitud todavía no fue aceptada.');
    if (this.vencida(s.resueltoEn)) throw new BadRequestException(`Pasaron más de ${HORAS_PARA_COMPLETAR} horas desde que te la aceptaron. Pide una nueva.`);
    const passwordHash = await bcrypt.hash(nueva, 10);
    await this.prisma.$transaction([
      this.prisma.usuario.update({
        where: { id: s.usuarioId },
        data: { passwordHash, mustChangePassword: false, failedLoginCount: 0, lockedUntil: null },
      }),
      // Cierra las sesiones abiertas con la contraseña anterior.
      this.prisma.refreshToken.updateMany({ where: { usuarioId: s.usuarioId, revocadoEn: null }, data: { revocadoEn: new Date() } }),
      this.prisma.solicitudRecuperacion.update({ where: { id: s.id }, data: { estado: 'usada', usadoEn: new Date() } }),
      this.prisma.logAuditoria.create({
        data: { actorId: s.usuarioId, accion: 'password_recuperada', entidad: 'usuario', entidadId: s.usuarioId, detalle: `Puso una nueva contraseña (solicitud aprobada por ${s.aprobador?.nombre ?? 'su docente'})` },
      }),
    ]);
    return { ok: true, usuario: usuarioDeAcceso(s.usuario) || s.usuario.email };
  }

  // ── Lado de quien aprueba (docente o admin) ──

  async pendientes(aprobadorId: number, rol: string) {
    const filas = await this.prisma.solicitudRecuperacion.findMany({
      where: { estado: 'pendiente', usuario: this.visiblesPara(aprobadorId, rol) },
      orderBy: { creadoEn: 'asc' },
      include: {
        usuario: {
          select: {
            id: true, nombre: true, nombres: true, cedula: true, ru: true, email: true, rol: true,
            paraleloRef: { select: { nombre: true, materia: { select: { nombre: true, gestion: true } } } },
          },
        },
      },
    });
    return filas.map((s) => ({
      id: s.id, fecha: s.creadoEn,
      persona: {
        id: s.usuario.id, nombre: s.usuario.nombre, rol: s.usuario.rol, ci: s.usuario.cedula, ru: s.usuario.ru,
        usuario: usuarioDeAcceso(s.usuario) || s.usuario.email,
        curso: s.usuario.paraleloRef ? `${s.usuario.paraleloRef.materia.nombre} ${s.usuario.paraleloRef.materia.gestion} · ${s.usuario.paraleloRef.nombre}` : null,
      },
    }));
  }

  async conteo(aprobadorId: number, rol: string) {
    return this.prisma.solicitudRecuperacion.count({ where: { estado: 'pendiente', usuario: this.visiblesPara(aprobadorId, rol) } });
  }

  async resolver(aprobadorId: number, rol: string, id: number, aceptar: boolean, motivo?: string) {
    const s = await this.prisma.solicitudRecuperacion.findFirst({
      where: { id, usuario: this.visiblesPara(aprobadorId, rol) },
      include: { usuario: { select: { nombre: true } } },
    });
    if (!s) throw new NotFoundException('Solicitud no encontrada.');
    if (s.estado !== 'pendiente') throw new BadRequestException('Esta solicitud ya fue resuelta.');
    await this.prisma.solicitudRecuperacion.update({
      where: { id },
      data: { estado: aceptar ? 'aprobada' : 'rechazada', aprobadorId, resueltoEn: new Date(), motivo: aceptar ? null : motivo?.trim() || null },
    });
    await this.prisma.logAuditoria.create({
      data: {
        actorId: aprobadorId, accion: aceptar ? 'recuperacion_aceptar' : 'recuperacion_rechazar', entidad: 'usuario', entidadId: s.usuarioId,
        detalle: `${aceptar ? 'Aceptó' : 'Rechazó'} que ${s.usuario.nombre} ponga una nueva contraseña${!aceptar && motivo ? ` (${motivo.trim()})` : ''}`,
      },
    });
    // Ya no hace falta el aviso en la campana de los demás aprobadores.
    await this.prisma.notificacion.updateMany({ where: { tipo: 'recuperacion_contrasena', refId: id }, data: { leida: true } }).catch(() => undefined);
    return { ok: true };
  }

  // ── Reglas ──

  /**
   * De quién puede aprobar cada uno: el admin, a todos; el docente, a los
   * estudiantes de los paralelos que dicta.
   */
  private visiblesPara(aprobadorId: number, rol: string): Prisma.UsuarioWhereInput {
    return rol === 'admin' ? {} : { rol: 'estudiante', paraleloRef: { docenteId: aprobadorId } };
  }

  private async aprobadoresDe(usuarioId: number) {
    const u = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { rol: true, paraleloRef: { select: { docente: { select: { id: true, nombre: true, activo: true } } } } },
    });
    const docente = u?.rol === 'estudiante' ? u.paraleloRef?.docente : null;
    if (docente?.activo) return { ids: [docente.id], esAdmin: false, descripcion: `tu docente, ${docente.nombre}` };
    const admins = await this.prisma.usuario.findMany({ where: { rol: 'admin', activo: true, id: { not: usuarioId } }, select: { id: true } });
    return { ids: admins.map((a) => a.id), esAdmin: true, descripcion: 'el administrador del sistema' };
  }

  private async propia(id: number, secreto: string) {
    const s = await this.prisma.solicitudRecuperacion.findUnique({
      where: { id },
      include: { usuario: { select: { id: true, nombre: true, nombres: true, cedula: true, email: true } }, aprobador: { select: { nombre: true } } },
    });
    // Mismo mensaje si no existe o si el secreto no coincide.
    if (!s || !secreto || s.secretoHash !== hash(secreto)) throw new NotFoundException('No encontramos tu solicitud. Pide una nueva.');
    return s;
  }

  private vencida(resueltoEn: Date | null) {
    return !!resueltoEn && Date.now() - resueltoEn.getTime() > HORAS_PARA_COMPLETAR * 3_600_000;
  }
}

function primerNombreVisible(u: { nombres?: string | null; nombre: string }) {
  return (u.nombres?.trim() || u.nombre).split(/\s+/)[0];
}
