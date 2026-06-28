import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../common/prisma/prisma.service';
import { JwtPayload } from '../common/auth/jwt.guard';
import { RegisterDto, LoginDto, PerfilDto, PasswordDto } from './dto/auth.dto';

const MAX_FALLIDOS = 5;
const BLOQUEO_MIN = 15;

// Campos públicos del usuario (nunca exponer hash ni internos de bloqueo).
const SELECT_PUBLICO = {
  id: true, nombre: true, email: true, rol: true, carrera: true,
  pretestCompletado: true, nivelInicial: true, grupo: true,
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
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

  async cambiarPassword(usuarioId: number, dto: PasswordDto) {
    const u = await this.prisma.usuario.findUnique({ where: { id: usuarioId }, select: { passwordHash: true } });
    if (!u) throw new UnauthorizedException();
    const ok = await bcrypt.compare(dto.actual, u.passwordHash);
    if (!ok) throw new BadRequestException('La contraseña actual no es correcta');
    const passwordHash = await bcrypt.hash(dto.nueva, 10);
    await this.prisma.usuario.update({ where: { id: usuarioId }, data: { passwordHash } });
    return { ok: true };
  }
}
