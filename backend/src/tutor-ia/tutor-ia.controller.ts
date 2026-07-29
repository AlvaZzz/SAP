import { Body, Controller, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { IsInt, IsString, IsOptional, MinLength, MaxLength, IsIn, Min } from 'class-validator';
import { TutorIaService } from './tutor-ia.service';
import { JwtAuthGuard } from '../common/auth/jwt.guard';
import { AiRateLimitGuard } from '../common/auth/ai-rate-limit.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';

class AsistenteDto {
  @IsString() @MinLength(2) @MaxLength(500) pregunta!: string;
  @IsOptional() @IsString() @MaxLength(120) contextoTema?: string;
  // Si el estudiante pregunta desde un ejercicio, ALVARO usa el material del
  // docente para ese tema (mismo estilo/sintaxis enseñado en clase).
  @IsOptional() @IsInt() @Min(1) ejercicio_id?: number;
}
class RetroDto {
  @IsInt() @Min(1) ejercicio_id!: number;
  @IsString() @MinLength(1) @MaxLength(120) respuesta_estudiante!: string;
}
class PistaDto {
  @IsInt() @Min(1) ejercicio_id!: number;
  @IsInt() @IsIn([1, 2, 3]) nivel_pista!: 1 | 2 | 3;
}
class PracticaDto {
  @IsString() @MinLength(1) @MaxLength(5000) codigo_actual!: string;
  @IsOptional() @IsString() @MaxLength(500) enunciado_reto?: string;
  @IsOptional() @IsString() @MaxLength(500) pregunta?: string;
}
class PistaRetoDto {
  @IsInt() @Min(1) reto_id!: number;
  @IsInt() @IsIn([1, 2, 3]) nivel_pista!: 1 | 2 | 3;
  @IsString() @MinLength(1) @MaxLength(5000) codigo_actual!: string;
}

/**
 * ALVARO — Tutor IA. Todos los endpoints requieren sesión y cuentan para el
 * límite de consultas por hora (AiRateLimitGuard). La clave Gemini vive solo
 * en el backend.
 */
@Controller('tutor-ia')
@UseGuards(JwtAuthGuard, AiRateLimitGuard)
export class TutorIaController {
  constructor(private readonly tutor: TutorIaService) {}

  @Post('asistente')
  asistente(@CurrentUser('sub') usuarioId: number, @Body() dto: AsistenteDto) {
    return this.tutor.asistente(usuarioId, dto.pregunta, dto.contextoTema, dto.ejercicio_id);
  }

  /**
   * Igual que /asistente pero en STREAMING (text/plain por chunks): el frontend
   * ve a ALVARO "escribiendo". Si la IA está apagada/no configurada, la excepción
   * se lanza ANTES del primer chunk (cabeceras no enviadas) → el filtro global la
   * formatea como JSON y el cliente cae al endpoint normal.
   */
  @Post('asistente/stream')
  async asistenteStream(
    @CurrentUser('sub') usuarioId: number,
    @Body() dto: AsistenteDto,
    @Res() res: Response,
  ) {
    try {
      for await (const chunk of this.tutor.asistenteStream(usuarioId, dto.pregunta, dto.contextoTema, dto.ejercicio_id)) {
        if (!res.headersSent) {
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache, no-transform');
          res.setHeader('X-Accel-Buffering', 'no'); // desactiva el buffering de nginx
        }
        res.write(chunk);
      }
    } catch (err) {
      if (!res.headersSent) throw err; // deja que el filtro global responda con JSON
    }
    res.end();
  }

  @Post('retroalimentacion')
  retroalimentacion(@CurrentUser('sub') usuarioId: number, @Body() dto: RetroDto) {
    return this.tutor.retroalimentacion(usuarioId, dto.ejercicio_id, dto.respuesta_estudiante);
  }

  @Post('pista')
  pista(@CurrentUser('sub') usuarioId: number, @Body() dto: PistaDto) {
    return this.tutor.pista(usuarioId, dto.ejercicio_id, dto.nivel_pista);
  }

  @Post('practica')
  practica(@CurrentUser('sub') usuarioId: number, @Body() dto: PracticaDto) {
    return this.tutor.practica(usuarioId, dto.codigo_actual, dto.enunciado_reto, dto.pregunta);
  }

  /** Streaming de la asistencia sobre el código (retos). Mismo patrón que asistente/stream. */
  @Post('practica/stream')
  async practicaStream(
    @CurrentUser('sub') usuarioId: number,
    @Body() dto: PracticaDto,
    @Res() res: Response,
  ) {
    try {
      for await (const chunk of this.tutor.practicaStream(usuarioId, dto.codigo_actual, dto.enunciado_reto, dto.pregunta)) {
        if (!res.headersSent) {
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache, no-transform');
          res.setHeader('X-Accel-Buffering', 'no');
        }
        res.write(chunk);
      }
    } catch (err) {
      if (!res.headersSent) throw err;
    }
    res.end();
  }

  @Post('pista-reto')
  pistaReto(@CurrentUser('sub') usuarioId: number, @Body() dto: PistaRetoDto) {
    return this.tutor.pistaReto(usuarioId, dto.reto_id, dto.nivel_pista, dto.codigo_actual);
  }
}
