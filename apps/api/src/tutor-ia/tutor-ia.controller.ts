import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsInt, IsString, IsOptional, MinLength, IsIn } from 'class-validator';
import { TutorIaService } from './tutor-ia.service';
import { JwtAuthGuard } from '../common/auth/jwt.guard';
import { AiRateLimitGuard } from '../common/auth/ai-rate-limit.guard';

class AsistenteDto {
  @IsString() @MinLength(2) pregunta!: string;
  @IsOptional() @IsString() contextoTema?: string;
}
class RetroDto {
  @IsString() respuestaEstudiante!: string;
  @IsString() respuestaCorrecta!: string;
  @IsOptional() @IsString() codigo?: string;
}
class PistaDto {
  @IsInt() @IsIn([1, 2, 3]) nivelPista!: 1 | 2 | 3;
  @IsOptional() @IsString() enunciado?: string;
  @IsOptional() @IsString() codigo?: string;
}

@Controller('ai')
@UseGuards(JwtAuthGuard, AiRateLimitGuard)
export class TutorIaController {
  constructor(private readonly tutor: TutorIaService) {}

  @Post('asistente')
  async asistente(@Body() dto: AsistenteDto) {
    return { respuesta: await this.tutor.asistente(dto.pregunta, dto.contextoTema) };
  }

  @Post('retroalimentacion')
  retroalimentacion(@Body() dto: RetroDto) {
    return this.tutor.retroalimentacion(dto);
  }

  @Post('pista')
  async pista(@Body() dto: PistaDto) {
    return { pista: await this.tutor.pista(dto) };
  }
}
