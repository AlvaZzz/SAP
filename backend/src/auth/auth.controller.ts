import { Body, Controller, Delete, Get, HttpException, HttpStatus, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response, CookieOptions } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import {
  RegisterDto, LoginDto, PerfilDto, PasswordDto, TourVistoDto,
  RecuperarDto, RestablecerDto, ValidarTokenDto,
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

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  private cookieOpts(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get('NODE_ENV') === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    };
  }

  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const { usuario, token } = await this.auth.register(dto);
    res.cookie(AUTH_COOKIE, token, this.cookieOpts());
    return { usuario, token };
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { usuario, token } = await this.auth.login(dto);
    res.cookie(AUTH_COOKIE, token, this.cookieOpts());
    return { usuario, token };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(AUTH_COOKIE, { path: '/' });
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

  @Put('password')
  @UseGuards(JwtAuthGuard)
  password(@CurrentUser('sub') usuarioId: number, @Body() dto: PasswordDto) {
    return this.auth.cambiarPassword(usuarioId, dto);
  }
}
