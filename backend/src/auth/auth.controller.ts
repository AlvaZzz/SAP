import { Body, Controller, Delete, Get, HttpException, HttpStatus, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response, CookieOptions } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import {
  RegisterDto, LoginDto, PerfilDto, PasswordDto, PrimerIngresoDto, TourVistoDto,
  RecuperarDto, RestablecerDto, ValidarTokenDto, PreferenciasAudioDto,
} from './dto/auth.dto';
import { JwtAuthGuard, AUTH_COOKIE, JwtPayload } from '../common/auth/jwt.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';

/**
 * Rate limit en memoria para la SOLICITUD de recuperación (anti-abuso). No usa
 * BD para no filtrar la existencia de correos y para no crecer sin control:
 * ventana deslizante por IP. Suficiente para el alcance de la tesis; en un
 * despliegue multi-instancia se sustituiría por Redis.
 */
const RECUP_MAX = 5; // solicitudes
const RECUP_VENTANA_MS = 15 * 60_000; // por 15 minutos
const recupHits = new Map<string, number[]>();

function limitarRecuperacion(ip: string): boolean {
  const ahora = Date.now();
  const previos = (recupHits.get(ip) ?? []).filter((t) => ahora - t < RECUP_VENTANA_MS);
  if (previos.length >= RECUP_MAX) { recupHits.set(ip, previos); return false; }
  previos.push(ahora);
  recupHits.set(ip, previos);
  return true;
}

/**
 * Rate limit del LOGIN POR IP, complementario al bloqueo por cuenta. El bloqueo
 * por cuenta no detiene a quien prueba UN intento contra MUCHOS correos distintos
 * desde el mismo origen; este sí. Mismo enfoque en memoria que el de recuperación
 * (bastante para el alcance de la tesis; con varias instancias iría en Redis).
 */
const LOGIN_IP_MAX = 15;               // fallos tolerados por IP
const LOGIN_IP_VENTANA_MS = 15 * 60_000;
const loginFallosPorIp = new Map<string, number[]>();

/** Segundos que faltan si la IP está frenada; 0 si puede intentar. */
function limitarLoginPorIp(ip: string): number {
  const ahora = Date.now();
  const previos = (loginFallosPorIp.get(ip) ?? []).filter((t) => ahora - t < LOGIN_IP_VENTANA_MS);
  loginFallosPorIp.set(ip, previos);
  if (previos.length < LOGIN_IP_MAX) return 0;
  const masAntiguo = previos[0];
  return Math.max(1, Math.ceil((LOGIN_IP_VENTANA_MS - (ahora - masAntiguo)) / 1000));
}

function registrarLoginFallido(ip: string) {
  const previos = loginFallosPorIp.get(ip) ?? [];
  previos.push(Date.now());
  loginFallosPorIp.set(ip, previos);
}

/** Un login correcto limpia el contador de esa IP (no castiga a un aula entera). */
function registrarLoginOk(ip: string) {
  loginFallosPorIp.delete(ip);
}

/** Vida del access token en la cookie (debe ir a la par de JWT_EXPIRES_IN). */
const ACCESS_MAX_AGE_MS = 15 * 60_000;
export const REFRESH_COOKIE = 'prexi_refresh';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Cookie del ACCESS token (15 min). `sameSite: 'strict'` es la defensa CSRF de
   * base: el navegador no envía la cookie en peticiones originadas por otro sitio,
   * que es el vector real de un CSRF. Se complementa con la verificación de Origin
   * en las mutaciones (ver OrigenGuard).
   */
  private cookieOpts(maxAgeMs = ACCESS_MAX_AGE_MS): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'strict',
      secure: this.config.get('NODE_ENV') === 'production',
      maxAge: maxAgeMs,
      path: '/',
    };
  }

  /** Cookie del REFRESH token: solo se envía a la ruta que la canjea. */
  private refreshCookieOpts(maxAgeMs: number): CookieOptions {
    return { ...this.cookieOpts(maxAgeMs), path: '/api/auth' };
  }

  /** Escribe ambas cookies tras un login/refresh correcto. */
  private sembrarSesion(res: Response, token: string, refresh: { token: string; maxAgeMs: number }) {
    res.cookie(AUTH_COOKIE, token, this.cookieOpts());
    res.cookie(REFRESH_COOKIE, refresh.token, this.refreshCookieOpts(refresh.maxAgeMs));
  }

  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const { usuario, token } = await this.auth.register(dto);
    const refresh = await this.auth.emitirRefresh(usuario.id, false);
    this.sembrarSesion(res, token, refresh);
    return { usuario, token };
  }

  /**
   * Login. El ROL de la respuesta sale de la BD; si el formulario tenía otro rol
   * seleccionado, se ignora (es una pista de UX, no una credencial).
   * Bloqueo por intentos → 429 con `retryAfterSeconds` (ver CuentaBloqueadaException).
   */
  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const ip = req.ip ?? req.socket?.remoteAddress ?? 'desconocida';
    // Límite POR IP además del límite por cuenta: frena el barrido de muchos
    // correos distintos desde un mismo origen (que el bloqueo por cuenta no ve).
    const restanteIp = limitarLoginPorIp(ip);
    if (restanteIp > 0) {
      throw new HttpException(
        { statusCode: HttpStatus.TOO_MANY_REQUESTS, message: 'Demasiados intentos desde esta conexión. Espera un momento.', retryAfterSeconds: restanteIp },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    try {
      const { usuario, token, refresh } = await this.auth.login(dto, { ip });
      registrarLoginOk(ip);
      this.sembrarSesion(res, token, refresh);
      return { usuario, token };
    } catch (e) {
      registrarLoginFallido(ip);
      throw e;
    }
  }

  /**
   * Refresh silencioso: canjea la cookie de refresh por un access token nuevo y
   * ROTA el refresh. Lo llama el frontend antes de mandar al usuario al login.
   */
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const actual = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    const { usuario, token, refresh } = await this.auth.refrescar(actual);
    this.sembrarSesion(res, token, refresh);
    return { usuario, token };
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const actual = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    await this.auth.revocarRefresh(actual);
    res.clearCookie(AUTH_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    return { ok: true };
  }

  // ── Recuperación de contraseña (pública, todos los roles) ──

  /** Paso 1: pedir el enlace. Respuesta SIEMPRE genérica (no revela el correo). */
  @Post('recuperar')
  recuperar(@Body() dto: RecuperarDto, @Req() req: Request) {
    const ip = req.ip ?? (req.socket?.remoteAddress ?? 'desconocida');
    if (!limitarRecuperacion(ip)) {
      throw new HttpException('Demasiadas solicitudes. Intenta de nuevo en unos minutos.', HttpStatus.TOO_MANY_REQUESTS);
    }
    return this.auth.solicitarRecuperacion(dto.email);
  }

  /** Paso 2 (UX): valida el token del enlace antes de mostrar el formulario. */
  @Get('recuperar/validar')
  validarToken(@Query() dto: ValidarTokenDto) {
    return this.auth.validarTokenRecuperacion(dto.token);
  }

  /** Paso 3: fijar la nueva contraseña con un token válido. */
  @Post('restablecer')
  restablecer(@Body() dto: RestablecerDto) {
    return this.auth.restablecerPassword(dto.token, dto.nueva);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser('sub') usuarioId: number) {
    return this.auth.me(usuarioId).then((usuario) => ({ usuario }));
  }

  @Put('perfil')
  @UseGuards(JwtAuthGuard)
  async perfil(@CurrentUser() user: JwtPayload, @Body() dto: PerfilDto) {
    return { usuario: await this.auth.actualizarPerfil(user.sub, dto) };
  }

  // ── Tours de onboarding (persistidos por usuario, no en localStorage) ──
  @Get('tours')
  @UseGuards(JwtAuthGuard)
  tours(@CurrentUser('sub') usuarioId: number) {
    return this.auth.toursVistos(usuarioId);
  }

  @Post('tours')
  @UseGuards(JwtAuthGuard)
  marcarTour(@CurrentUser('sub') usuarioId: number, @Body() dto: TourVistoDto) {
    return this.auth.marcarTourVisto(usuarioId, dto.clave);
  }

  /** "Volver a ver los tutoriales" (perfil): vacía los tours vistos. */
  @Delete('tours')
  @UseGuards(JwtAuthGuard)
  reiniciarTours(@CurrentUser('sub') usuarioId: number) {
    return this.auth.reiniciarTours(usuarioId);
  }

  /** Preferencias de audio: sonidos de logros y lectura en voz alta automática. */
  @Put('preferencias-audio')
  @UseGuards(JwtAuthGuard)
  preferenciasAudio(@CurrentUser('sub') usuarioId: number, @Body() dto: PreferenciasAudioDto) {
    return this.auth.guardarPreferenciasAudio(usuarioId, dto);
  }

  /** Primer ingreso: define la contraseña definitiva (cuentas con contraseña temporal). */
  @Post('primer-ingreso')
  @UseGuards(JwtAuthGuard)
  primerIngreso(@CurrentUser('sub') usuarioId: number, @Body() dto: PrimerIngresoDto) {
    return this.auth.primerIngreso(usuarioId, dto);
  }

  @Put('password')
  @UseGuards(JwtAuthGuard)
  password(@CurrentUser('sub') usuarioId: number, @Body() dto: PasswordDto) {
    return this.auth.cambiarPassword(usuarioId, dto);
  }
}
