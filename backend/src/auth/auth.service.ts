import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { MailService } from '../common/mail/mail.service';
import { JwtPayload } from '../common/auth/jwt.guard';
import { RegisterDto, LoginDto, PerfilDto, PasswordDto } from './dto/auth.dto';

const MAX_FALLIDOS = 5;
const BLOQUEO_MIN = 15;
// Vida útil del enlace de recuperación (corta, por seguridad).
const RECUPERACION_MIN = 45;

// Campos públicos del usuario (nunca exponer hash ni internos de bloqueo).
const SELECT_PUBLICO = {
  id: true, nombre: true, email: true, rol: true, carrera: true,
  introduccionCompletada: true, pretestCompletado: true, nivelInicial: true, grupo: true, mustChangePassword: true,
  paralelo: true, semestre: true,
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  firmarToken(u: { id: number; rol: JwtPayload['rol']; nombre: string }): string {
    const payload: JwtPayload = { sub: u.id, rol: u.rol, nombre: u.nombre };
    return this.jwt.sign(payload);
  }

  async register(dto: RegisterDto) {
    if (await this.prisma.usuario.findUnique({ where: { email: dto.email } }))
      throw new BadRequestException('Ya existe un usuario con ese correo');
    if (await this.prisma.usuario.findUnique({ where: { cedula: dto.cedula } }))
      throw new BadRequestException('Ya existe un usuario con esa cédula');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const usuario = await this.prisma.usuario.create({
      data: {
        nombre: dto.nombre, email: dto.email, cedula: dto.cedula,
        carrera: dto.carrera, passwordHash, rol: 'estudiante',
        paralelo: dto.paralelo.trim().toUpperCase(), semestre: dto.semestre ?? 1,
        ranking: { create: { xpTotal: 0, rachaDias: 0 } },
      },
      select: SELECT_PUBLICO,
    });

    return { usuario, token: this.firmarToken(usuario) };
  }

  async login(dto: LoginDto) {
    const u = await this.prisma.usuario.findUnique({ where: { email: dto.email } });
    const credInvalidas = () => new UnauthorizedException('Correo o contraseña incorrectos');
    if (!u) throw credInvalidas();

    // Cuenta desactivada por el administrador (soft-disable): no puede ingresar.
    if (!u.activo) throw new HttpException('Tu cuenta está desactivada. Contacta al administrador.', HttpStatus.FORBIDDEN);

    if (u.lockedUntil && u.lockedUntil.getTime() > Date.now()) {
      throw new HttpException(
        `Cuenta bloqueada temporalmente, intenta en ${BLOQUEO_MIN} minutos`,
        423,
      );
    }

    const ok = await bcrypt.compare(dto.password, u.passwordHash);
    if (!ok) {
      const nuevos = u.failedLoginCount + 1;
      if (nuevos >= MAX_FALLIDOS) {
        await this.prisma.usuario.update({
          where: { id: u.id },
          data: { failedLoginCount: 0, lockedUntil: new Date(Date.now() + BLOQUEO_MIN * 60_000) },
        });
        throw new HttpException(
          `Cuenta bloqueada temporalmente, intenta en ${BLOQUEO_MIN} minutos`,
          423,
        );
      }
      await this.prisma.usuario.update({ where: { id: u.id }, data: { failedLoginCount: nuevos } });
      throw credInvalidas();
    }

    await this.prisma.usuario.update({
      where: { id: u.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });

    const usuario = await this.prisma.usuario.findUnique({ where: { id: u.id }, select: SELECT_PUBLICO });
    return { usuario, token: this.firmarToken(u) };
  }

  async me(usuarioId: number) {
    return this.prisma.usuario.findUnique({ where: { id: usuarioId }, select: SELECT_PUBLICO });
  }

  async actualizarPerfil(usuarioId: number, dto: PerfilDto) {
    return this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { nombre: dto.nombre, carrera: dto.carrera },
      select: SELECT_PUBLICO,
    });
  }

  // ── Tours/onboarding vistos (persistencia por usuario) ──
  async toursVistos(usuarioId: number) {
    const u = await this.prisma.usuario.findUnique({ where: { id: usuarioId }, select: { toursVistos: true } });
    return { vistos: u?.toursVistos ?? [] };
  }

  async marcarTourVisto(usuarioId: number, clave: string) {
    const u = await this.prisma.usuario.findUnique({ where: { id: usuarioId }, select: { toursVistos: true } });
    if (!u) throw new UnauthorizedException();
    if (!u.toursVistos.includes(clave)) {
      await this.prisma.usuario.update({ where: { id: usuarioId }, data: { toursVistos: { push: clave } } });
    }
    return { ok: true };
  }

  async reiniciarTours(usuarioId: number) {
    await this.prisma.usuario.update({ where: { id: usuarioId }, data: { toursVistos: [] } });
    return { ok: true };
  }

  async cambiarPassword(usuarioId: number, dto: PasswordDto) {
    const u = await this.prisma.usuario.findUnique({ where: { id: usuarioId }, select: { passwordHash: true } });
    if (!u) throw new UnauthorizedException();
    const ok = await bcrypt.compare(dto.actual, u.passwordHash);
    if (!ok) throw new BadRequestException('La contraseña actual no es correcta');
    const passwordHash = await bcrypt.hash(dto.nueva, 10);
    await this.prisma.usuario.update({ where: { id: usuarioId }, data: { passwordHash } });
    return { ok: true };
  }

  // ════════════════════════════════════════════════════════════
  //  Recuperación de contraseña (disponible para TODOS los roles)
  // ════════════════════════════════════════════════════════════

  /** Respuesta genérica: NUNCA revela si el correo está registrado (privacidad). */
  private readonly RESPUESTA_GENERICA = {
    ok: true,
    mensaje: 'Si el correo existe, te enviamos un enlace para restablecer tu contraseña.',
  } as const;

  /** Solo el HASH del token se guarda en la BD (nunca el valor en claro). */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Paso 1: el usuario pide recuperar su contraseña por correo.
   * - Respuesta SIEMPRE genérica (no filtra existencia del correo).
   * - Si el correo existe y la cuenta está activa: invalida tokens previos,
   *   genera un token aleatorio de un solo uso con expiración corta, guarda su
   *   HASH y envía el enlace por correo (o lo registra en logs en desarrollo).
   */
  async solicitarRecuperacion(email: string) {
    const correo = email.trim().toLowerCase();
    const u = await this.prisma.usuario.findUnique({
      where: { email: correo },
      select: { id: true, nombre: true, email: true, activo: true },
    });

    // Cuenta inexistente o desactivada → misma respuesta, sin enviar nada.
    if (u && u.activo) {
      // Invalida cualquier token de recuperación pendiente del usuario.
      await this.prisma.tokenRecuperacion.updateMany({
        where: { usuarioId: u.id, usadoEn: null },
        data: { usadoEn: new Date() },
      });

      const token = randomBytes(32).toString('hex');
      await this.prisma.tokenRecuperacion.create({
        data: {
          usuarioId: u.id,
          tokenHash: this.hashToken(token),
          expiraEn: new Date(Date.now() + RECUPERACION_MIN * 60_000),
        },
      });

      const base = (this.config.get<string>('APP_URL') ?? 'http://localhost:3000').replace(/\/+$/, '');
      const enlace = `${base}/restablecer-contrasena?token=${token}`;
      // El envío nunca debe filtrar existencia ni romper la respuesta.
      await this.mail.enviarRecuperacion(u.email, u.nombre, enlace).catch(() => undefined);
    }

    return this.RESPUESTA_GENERICA;
  }

  /** Busca un token de recuperación VÁLIDO (existe, no usado y no expirado). */
  private async tokenValido(token: string) {
    const registro = await this.prisma.tokenRecuperacion.findUnique({
      where: { tokenHash: this.hashToken(token) },
    });
    if (!registro || registro.usadoEn || registro.expiraEn.getTime() < Date.now()) return null;
    return registro;
  }

  /** Paso 2 (UX): valida el token del enlace antes de mostrar el formulario. */
  async validarTokenRecuperacion(token: string) {
    return { valido: !!(await this.tokenValido(token)) };
  }

  /**
   * Paso 3: restablece la contraseña con un token válido.
   * - Verifica el token (válido, no expirado, no usado).
   * - Hashea la nueva contraseña (bcrypt), invalida el token (un solo uso) y
   *   limpia el estado de bloqueo/forzado de cambio para que el usuario entre.
   */
  async restablecerPassword(token: string, nueva: string) {
    const registro = await this.tokenValido(token);
    if (!registro) throw new BadRequestException('El enlace no es válido o ya expiró. Solicita uno nuevo.');

    const passwordHash = await bcrypt.hash(nueva, 10);
    await this.prisma.$transaction([
      this.prisma.usuario.update({
        where: { id: registro.usuarioId },
        data: { passwordHash, failedLoginCount: 0, lockedUntil: null, mustChangePassword: false },
      }),
      // Marca ESTE token como usado e invalida cualquier otro pendiente.
      this.prisma.tokenRecuperacion.updateMany({
        where: { usuarioId: registro.usuarioId, usadoEn: null },
        data: { usadoEn: new Date() },
      }),
    ]);

    return { ok: true, mensaje: 'Tu contraseña fue actualizada. Ya puedes iniciar sesión.' };
  }
}
