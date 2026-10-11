import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsInt, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { InstrumentosService } from './instrumentos.service';
import { JwtAuthGuard } from '../../common/auth/jwt.guard';
import { RolesGuard, Roles } from '../../common/auth/roles.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';

class RespuestaItemDto {
  @IsString() @MaxLength(20) itemId!: string;
  @IsInt() @Min(1) @Max(5) valor!: number;
}

class ResponderInstrumentoDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100)
  @ValidateNested({ each: true }) @Type(() => RespuestaItemDto)
  respuestas!: RespuestaItemDto[];

  @IsBoolean() aceptaConsentimiento!: boolean;
}

class CambiarFaseDto {
  @IsBoolean() activa!: boolean;
}

/**
 * Instrumentos de valoración del estudio: SUS (estudiantes) e ISO/IEC 25010
 * (docentes y evaluadores). Ver InstrumentosService.
 */
@Controller('instrumentos')
@UseGuards(JwtAuthGuard)
export class InstrumentosController {
  constructor(private readonly service: InstrumentosService) {}

  /** ¿Qué cuestionario le toca a este usuario y ya lo respondió? */
  @Get('estado')
  estado(@CurrentUser('sub') usuarioId: number, @CurrentUser('rol') rol: string) {
    return this.service.estado(usuarioId, rol);
  }

  /** Habilita o cierra la fase de evaluación del sistema. */
  @Post('fase')
  @UseGuards(RolesGuard)
  @Roles('docente', 'admin')
  cambiarFase(@Body() dto: CambiarFaseDto) {
    return this.service.cambiarFase(dto.activa);
  }

  @Get(':clave')
  cuestionario(@CurrentUser('sub') usuarioId: number, @CurrentUser('rol') rol: string, @Param('clave') clave: string) {
    return this.service.cuestionario(usuarioId, rol, clave.toUpperCase());
  }

  @Post(':clave')
  responder(
    @CurrentUser('sub') usuarioId: number,
    @CurrentUser('rol') rol: string,
    @Param('clave') clave: string,
    @Body() dto: ResponderInstrumentoDto,
  ) {
    return this.service.responder(usuarioId, rol, clave.toUpperCase(), dto.respuestas, dto.aceptaConsentimiento);
  }
}
