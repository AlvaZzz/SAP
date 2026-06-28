import { Body, Controller, Get, Post, Put, Res, UseGuards } from '@nestjs/common';
import { Response, CookieOptions } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, PerfilDto, PasswordDto } from './dto/auth.dto';
import { JwtAuthGuard, AUTH_COOKIE, JwtPayload } from '../common/auth/jwt.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';

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

  @Put('password')
  @UseGuards(JwtAuthGuard)
  password(@CurrentUser('sub') usuarioId: number, @Body() dto: PasswordDto) {
    return this.auth.cambiarPassword(usuarioId, dto);
  }
}
