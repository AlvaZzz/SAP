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
/**
 * Versión del texto de términos y política de privacidad que el estudiante
 * acepta al registrarse. Se guarda junto a la fecha para que quede constancia
 * de QUÉ se consintió, no solo de que se consintió. Súbela si cambia el texto.
 */
export const VERSION_TERMINOS = '2026-10-v2';
// Vida útil del enlace de recuperación (corta, por seguridad).
const RECUPERACION_MIN = 45;
// Sesión larga (refresh token): con "Recordarme" dura 30 días; sin él, 1 día.
const REFRESH_DIAS_RECORDADO = 30;
const REFRESH_DIAS_SIMPLE = 1;

/**
 * Bloqueo por credenciales: 429 con los segundos que faltan. Se usa 429 (y no
 * 423) porque el frontend distingue los casos por CÓDIGO DE ESTADO, y
 * `retryAfterSeconds` le permite mostrar la cuenta atrás sin parsear texto.
 */
export class CuentaBloqueadaException extends HttpException {
  constructor(segundos: number) {
    super(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: 'Demasiados intentos fallidos. Espera antes de volver a intentar.',
        retryAfterSeconds: segundos,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

// Campos públicos del usuario (nunca exponer hash ni internos de bloqueo).
const SELECT_PUBLICO = {
  id: true, nombre: true, email: true, rol: true, carrera: true,
  introduccionCompletada: true, pretestCompletado: true, nivelInicial: true, mustChangePassword: true,
  paralelo: true, semestre: true,
  // Preferencias de audio (sonidos de logros / lectura en voz alta automática).
  sonidosActivados: true, vozAutomatica: true,
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
    const paralelo = dto.paralelo.trim().toUpperCase();

    const usuario = await this.prisma.usuario.create({
      data: {
        nombre: dto.nombre, email: dto.email, cedula: dto.cedula,
        carrera: dto.carrera, passwordHash, rol: 'estudiante',
        paralelo, semestre: dto.semestre ?? 1,
        // Constancia del consentimiento informado, con fecha. Solo si el cliente
        // lo declara de forma explícita: si no llega, queda sin registro y el
        // rol investigador lo reporta como tal (no se presume otorgado).
        ...(dto.aceptaTerminos === true
          ? { consentimientoEn: new Date(), consentimientoVersion: VERSION_TERMINOS }
          : {}),
        ranking: { create: { xpTotal: 0, rachaDias: 0 } },
      },
      select: SELECT_PUBLICO,
    });

    return { usuario, token: this.firmarToken(usuario) };
  }

  /** Segundos que faltan para que expire un bloqueo (0 si ya pasó). */
  private segundosRestantes(hasta: Date | null): number {
    if (!hasta) return 0;
    return Math.max(0, Math.ceil((hasta.getTime() - Date.now()) / 1000));
  }

  /**
   * Auditoría de seguridad. Solo se registra cuando el usuario EXISTE: LogAuditoria
   * exige un actor real y, además, guardar los correos tecleados en intentos
   * fallidos filtraría a la tabla de auditoría datos que no queremos conservar.
   */
  private async auditar(actorId: number, accion: string, detalle: string) {
    // La auditoría NUNCA debe tumbar un login: si falla el registro, se ignora.
    try {
      await this.prisma.logAuditoria.create({
        data: { actorId, accion, entidad: 'usuario', entidadId: actorId, detalle },
      });
    } catch { /* registro de auditoría no disponible */ }
  }

  async login(dto: LoginDto, contexto: { ip?: string } = {}) {
    const u = await this.prisma.usuario.findUnique({ where: { email: dto.email } });
    // MISMO mensaje si el correo no existe o si la contraseña es incorrecta: de
    // otro modo se podrían enumerar las cuentas registradas probando correos.
    const credInvalidas = () => new UnauthorizedException('Correo o contraseña incorrectos');
    if (!u) throw credInvalidas();

    // Cuenta desactivada por el administrador (soft-disable): no puede ingresar.
    if (!u.activo) throw new HttpException('Tu cuenta está desactivada. Contacta al administrador.', HttpStatus.FORBIDDEN);

    const restante = this.segundosRestantes(u.lockedUntil);
    if (restante > 0) throw new CuentaBloqueadaException(restante);

    const ok = await bcrypt.compare(dto.password, u.passwordHash);
    if (!ok) {
      const nuevos = u.failedLoginCount + 1;
      if (nuevos >= MAX_FALLIDOS) {
        const hasta = new Date(Date.now() + BLOQUEO_MIN * 60_000);
        await this.prisma.usuario.update({
          where: { id: u.id },
          data: { failedLoginCount: 0, lockedUntil: hasta },
        });
        await this.auditar(u.id, 'login_bloqueo', `Cuenta bloqueada ${BLOQUEO_MIN} min tras ${MAX_FALLIDOS} intentos fallidos${contexto.ip ? ` (IP ${contexto.ip})` : ''}`);
        throw new CuentaBloqueadaException(BLOQUEO_MIN * 60);
      }
      await this.prisma.usuario.update({ where: { id: u.id }, data: { failedLoginCount: nuevos } });
      await this.auditar(u.id, 'login_fallido', `Intento fallido ${nuevos}/${MAX_FALLIDOS}${contexto.ip ? ` (IP ${contexto.ip})` : ''}`);
      throw credInvalidas();
    }

    await this.prisma.usuario.update({
      where: { id: u.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });

    const usuario = await this.prisma.usuario.findUnique({ where: { id: u.id }, select: SELECT_PUBLICO });
    // El ROL viaja desde la BD: el que el formulario tuviera seleccionado es solo
    // una pista de UX y nunca se usa como credencial.
    const refresh = await this.emitirRefresh(u.id, dto.recordarme ?? false);
    return { usuario, token: this.firmarToken(u), refresh };
  }

  // ════════════════════════════════════════════════════════════
  //  Sesión larga: refresh token opaco, hasheado y ROTATORIO
  // ════════════════════════════════════════════════════════════

  /** Emite un refresh token nuevo y devuelve el valor en claro (solo se ve aquí). */
  async emitirRefresh(usuarioId: number, recordado: boolean) {
    const token = randomBytes(48).toString('hex');
    const dias = recordado ? REFRESH_DIAS_RECORDADO : REFRESH_DIAS_SIMPLE;
    const expiraEn = new Date(Date.now() + dias * 24 * 60 * 60_000);
    await this.prisma.refreshToken.create({
      data: { usuarioId, tokenHash: this.hashToken(token), expiraEn, recordado },
    });
    return { token, expiraEn, recordado, maxAgeMs: dias * 24 * 60 * 60_000 };
  }

  /**
   * Canjea un refresh token por un access token nuevo, ROTÁNDOLO.
   *
   * Si llega un token ya revocado se asume robo (alguien reutiliza uno viejo) y se
   * revocan TODAS las sesiones del usuario: es preferible obligar a reingresar
   * que mantener viva una sesión potencialmente comprometida.
   */
  async refrescar(token: string | undefined) {
    if (!token) throw new UnauthorizedException('Sesión expirada');
    const registro = await this.prisma.refreshToken.findUnique({ where: { tokenHash: this.hashToken(token) } });
    if (!registro) throw new UnauthorizedException('Sesión expirada');

    if (registro.revocadoEn) {
      await this.prisma.refreshToken.updateMany({
        where: { usuarioId: registro.usuarioId, revocadoEn: null },
        data: { revocadoEn: new Date() },
      });
      await this.auditar(registro.usuarioId, 'refresh_reutilizado', 'Se reutilizó un refresh token ya revocado; se cerraron todas las sesiones.');
      throw new UnauthorizedException('Sesión expirada');
    }
    if (registro.expiraEn.getTime() < Date.now()) throw new UnauthorizedException('Sesión expirada');

    const u = await this.prisma.usuario.findUnique({ where: { id: registro.usuarioId } });
    if (!u || !u.activo) throw new UnauthorizedException('Sesión expirada');

    // Rotación: se invalida el usado y se emite uno nuevo con la misma duración.
    await this.prisma.refreshToken.update({ where: { id: registro.id }, data: { revocadoEn: new Date() } });
    const refresh = await this.emitirRefresh(u.id, registro.recordado);
    const usuario = await this.prisma.usuario.findUnique({ where: { id: u.id }, select: SELECT_PUBLICO });
    return { usuario, token: this.firmarToken(u), refresh };
  }

  /** Cierra la sesión: revoca el refresh token presentado (o todos los del usuario). */
  async revocarRefresh(token?: string, usuarioId?: number) {
    if (token) {
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash: this.hashToken(token), revocadoEn: null },
        data: { revocadoEn: new Date() },
      });
    } else if (usuarioId) {
      await this.prisma.refreshToken.updateMany({ where: { usuarioId, revocadoEn: null }, data: { revocadoEn: new Date() } });
    }
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

  /**
   * Guarda las preferencias de AUDIO del usuario (sonidos de logros / lectura en
   * voz alta automática). Solo actualiza lo que venga en el DTO; devuelve el
   * usuario público para que el frontend refresque su estado.
   */
  async guardarPreferenciasAudio(usuarioId: number, dto: { sonidosActivados?: boolean; vozAutomatica?: boolean }) {
    const data = {
      ...(dto.sonidosActivados !== undefined ? { sonidosActivados: dto.sonidosActivados } : {}),
      ...(dto.vozAutomatica !== undefined ? { vozAutomatica: dto.vozAutomatica } : {}),
    };
    if (!Object.keys(data).length) throw new BadRequestException('No se envió ninguna preferencia');
    const usuario = await this.prisma.usuario.update({ where: { id: usuarioId }, data, select: SELECT_PUBLICO });
    return { usuario };
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
      // Cambiar la contraseña CIERRA todas las sesiones abiertas: si alguien
      // había entrado con la contraseña anterior, deja de tener acceso.
      this.prisma.refreshToken.updateMany({
        where: { usuarioId: registro.usuarioId, revocadoEn: null },
        data: { revocadoEn: new Date() },
      }),
    ]);
    await this.auditar(registro.usuarioId, 'password_restablecida', 'Contraseña restablecida por enlace de recuperación; sesiones cerradas.');

    return { ok: true, mensaje: 'Tu contraseña fue actualizada. Ya puedes iniciar sesión.' };
  }
}
