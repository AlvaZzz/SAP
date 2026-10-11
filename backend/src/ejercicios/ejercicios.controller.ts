import { Controller, Get, Post, Param, Query, Body, ParseIntPipe, UseGuards } from '@nestjs/common';
import { IsArray, IsInt, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { EjerciciosService } from './ejercicios.service';
import { AdaptatividadService } from './adaptatividad.service';
import { LogAdaptacionService } from './log-adaptacion.service';
import { msDesde } from '../mediciones/motor/motor';
import { ResponderDto } from './dto/responder.dto';
import { JwtAuthGuard } from '../common/auth/jwt.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';

// Una respuesta del mini-diagnóstico de subida de nivel.
class RespuestaSubidaDto {
  @IsInt() @Min(1) ejercicioId!: number;
  @IsString() respuesta!: string;
}
class EvaluarSubidaDto {
  @IsInt() @Min(1) temaId!: number;
  @IsArray() @ValidateNested({ each: true }) @Type(() => RespuestaSubidaDto) respuestas!: RespuestaSubidaDto[];
}

@Controller()
@UseGuards(JwtAuthGuard)
export class EjerciciosController {
  constructor(
    private readonly ejercicios: EjerciciosService,
    private readonly adaptatividad: AdaptatividadService,
    private readonly logMotor: LogAdaptacionService,
  ) {}

  @Get('niveles')
  async niveles(@CurrentUser('sub') usuarioId: number) {
    return { niveles: await this.ejercicios.niveles(usuarioId) };
  }

  @Get('ejercicios')
  async listar(@Query('nivel') nivel?: string, @Query('categoria') categoria?: string, @Query('tema') tema?: string) {
    return { ejercicios: await this.ejercicios.listar(nivel ? Number(nivel) : undefined, categoria, tema ? Number(tema) : undefined) };
  }

  // Debe declararse ANTES de :id para no chocar con el ParseIntPipe.
  @Get('ejercicios/resueltos')
  async resueltos(@CurrentUser('sub') usuarioId: number) {
    return { ids: await this.ejercicios.resueltos(usuarioId) };
  }

  // Ruta ADAPTATIVA del estudiante (mismo banco, orden personalizado por dificultad).
  @Get('ejercicios/ruta')
  async ruta(@CurrentUser('sub') usuarioId: number, @Query('nivel') nivel?: string, @Query('tema') tema?: string) {
    return this.adaptatividad.ruta(usuarioId, {
      nivel: nivel ? Number(nivel) : undefined,
      temaId: tema ? Number(tema) : undefined,
    });
  }

  // Evidencia: la secuencia de ejercicios que siguió el estudiante (para la tesis).
  @Get('ejercicios/mi-ruta')
  async miRuta(@CurrentUser('sub') usuarioId: number) {
    return { pasos: await this.adaptatividad.miRuta(usuarioId) };
  }

  // ── Subir de nivel (mini-diagnóstico del nivel objetivo) ──
  @Get('ejercicios/subir-nivel')
  async iniciarSubida(@CurrentUser('sub') usuarioId: number, @Query('tema', ParseIntPipe) tema: number) {
    return this.adaptatividad.iniciarSubida(usuarioId, tema);
  }

  @Get('ejercicios/subir-nivel/intentos')
  async intentosSubida(@CurrentUser('sub') usuarioId: number, @Query('tema', ParseIntPipe) tema: number) {
    return { intentos: await this.adaptatividad.intentosSubida(usuarioId, tema) };
  }

  @Post('ejercicios/subir-nivel')
  async evaluarSubida(@CurrentUser('sub') usuarioId: number, @Body() dto: EvaluarSubidaDto) {
    return this.adaptatividad.evaluarSubida(usuarioId, dto.temaId, dto.respuestas);
  }

  /**
   * Detalle de un ejercicio. GATING POR NIVEL: antes no pedía siquiera el usuario,
   * así que cualquier id devolvía el ejercicio completo. Ahora se comprueba contra
   * el nivel del estudiante en ese tema (ver AdaptatividadService, punto único).
   */
  @Get('ejercicios/:id')
  async detalle(
    @CurrentUser('sub') usuarioId: number,
    @CurrentUser('rol') rol: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const ejercicio = await this.ejercicios.detalle(id);
    await this.adaptatividad.verificarAccesoEjercicio(usuarioId, ejercicio, rol);
    return { ejercicio };
  }

  @Post('intentos')
  async responder(@CurrentUser('sub') usuarioId: number, @Body() dto: ResponderDto) {
    // Instante de llegada de la respuesta, medido en el backend (no en el cliente).
    const inicio = process.hrtime.bigint();
    const { motor, ...resultado } = await this.ejercicios.responder(usuarioId, dto, inicio);
    // Registra el paso de la ruta como evidencia (best-effort).
    const ej = await this.ejercicios.detalle(dto.ejercicioId).catch(() => null);
    await this.adaptatividad.registrarIntento(
      usuarioId, dto.ejercicioId, resultado.correcto, ej?.nivelDificultad ?? 'basico', ej?.estrellas ?? 0,
    );
    // LOG DEL MOTOR ADAPTATIVO (instrumento de la tesis). El tiempo de
    // retroalimentación se cierra aquí, con la respuesta ya lista; el registro se
    // lanza SIN esperar para no frenar al estudiante.
    void this.logMotor.registrar(usuarioId, motor, msDesde(inicio));
    return resultado;
  }
}
