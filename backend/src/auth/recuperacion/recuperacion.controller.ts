import { Body, Controller, Get, HttpException, HttpStatus, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../../common/auth/jwt.guard';
import { RolesGuard, Roles } from '../../common/auth/roles.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { PASSWORD_MENSAJE, PASSWORD_REGEX } from '../dto/auth.dto';
import { RecuperacionService } from './recuperacion.service';

class SolicitarDto {
  @IsString() @MinLength(3, { message: 'Escribe tu usuario.' }) @MaxLength(120)
  usuario!: string;
}
class SecretoDto {
  @IsString() @MinLength(20) @MaxLength(200)
  secreto!: string;
}
class CompletarDto extends SecretoDto {
  @IsString() @MaxLength(100) @Matches(PASSWORD_REGEX, { message: PASSWORD_MENSAJE })
  nueva!: string;
}
class ResolverDto {
  @IsBoolean() aceptar!: boolean;
  @IsOptional() @IsString() @MaxLength(300) motivo?: string;
}

// Límite por IP para pedir recuperaciones (evita llenar de avisos a los docentes).
const VENTANA_MS = 15 * 60_000;
const MAX_POR_VENTANA = 5;
const pedidos = new Map<string, number[]>();
function dentroDelLimite(ip: string): boolean {
  const ahora = Date.now();
  const previos = (pedidos.get(ip) ?? []).filter((t) => ahora - t < VENTANA_MS);
  if (previos.length >= MAX_POR_VENTANA) { pedidos.set(ip, previos); return false; }
  pedidos.set(ip, [...previos, ahora]);
  return true;
}

/** Quien olvidó su contraseña: pide, consulta y completa (sin sesión). */
@Controller('auth/recuperacion')
export class RecuperacionPublicaController {
  constructor(private readonly service: RecuperacionService) {}

  @Post()
  solicitar(@Body() dto: SolicitarDto, @Req() req: Request) {
    if (!dentroDelLimite(req.ip ?? req.socket?.remoteAddress ?? 'desconocida')) {
      throw new HttpException('Ya pediste varias veces. Espera unos minutos e inténtalo de nuevo.', HttpStatus.TOO_MANY_REQUESTS);
    }
    return this.service.solicitar(dto.usuario);
  }

  @Get(':id')
  estado(@Param('id', ParseIntPipe) id: number, @Query() dto: SecretoDto) {
    return this.service.estado(id, dto.secreto);
  }

  @Post(':id/completar')
  completar(@Param('id', ParseIntPipe) id: number, @Body() dto: CompletarDto) {
    return this.service.completar(id, dto.secreto, dto.nueva);
  }
}

/** Quien aprueba: el docente (sus estudiantes) o el administrador (todos). */
@Controller('recuperaciones')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('docente', 'admin')
export class RecuperacionAprobacionController {
  constructor(private readonly service: RecuperacionService) {}

  @Get()
  async pendientes(@CurrentUser('sub') id: number, @CurrentUser('rol') rol: string) {
    return { solicitudes: await this.service.pendientes(id, rol) };
  }

  @Get('conteo')
  async conteo(@CurrentUser('sub') id: number, @CurrentUser('rol') rol: string) {
    return { pendientes: await this.service.conteo(id, rol) };
  }

  @Post(':id/resolver')
  resolver(@CurrentUser('sub') aprobadorId: number, @CurrentUser('rol') rol: string, @Param('id', ParseIntPipe) id: number, @Body() dto: ResolverDto) {
    return this.service.resolver(aprobadorId, rol, id, dto.aceptar, dto.motivo);
  }
}
