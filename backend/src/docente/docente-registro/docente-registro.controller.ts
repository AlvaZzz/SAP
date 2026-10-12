import {
  Body, Controller, Get, Header, Param, ParseIntPipe, Patch, Post, Res, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';
import { DocenteRegistroService, MAX_FILAS_LISTA, MAX_LISTA_BYTES } from './docente-registro.service';
import { JwtAuthGuard } from '../../common/auth/jwt.guard';
import { RolesGuard, Roles } from '../../common/auth/roles.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';

class CrearMateriaDto {
  @IsString() @MinLength(2) @MaxLength(80) nombre!: string;
  @IsOptional() @IsString() @MaxLength(20) sigla?: string;
  @IsString() @MinLength(2) @MaxLength(20) gestion!: string;
}

class CrearParaleloDto {
  @IsInt() @Min(1) materiaId!: number;
  @IsString() @MinLength(1) @MaxLength(10) nombre!: string;
  @IsOptional() @IsBoolean() soyDocente?: boolean;
}

class AsignarmeDto {
  @IsBoolean() asignar!: boolean;
}

class FilaDto {
  @IsOptional() @IsInt() fila!: number;
  @IsString() @MaxLength(60) apellidoPaterno!: string;
  @IsString() @MaxLength(60) apellidoMaterno!: string;
  @IsString() @MaxLength(80) nombres!: string;
  @IsString() @MaxLength(20) ci!: string;
  @IsString() @MaxLength(20) ru!: string;
  @IsString() @MaxLength(10) paralelo!: string;
}

class ListaDto {
  @IsInt() @Min(1) materiaId!: number;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(MAX_FILAS_LISTA)
  @ValidateNested({ each: true }) @Type(() => FilaDto)
  filas!: FilaDto[];
}

class MapeoDto {
  @IsOptional() @IsInt() @Min(0) apellidoPaterno?: number | null;
  @IsOptional() @IsInt() @Min(0) apellidoMaterno?: number | null;
  @IsOptional() @IsInt() @Min(0) nombres?: number | null;
  @IsOptional() @IsInt() @Min(0) nombreCompleto?: number | null;
  @IsOptional() @IsInt() @Min(0) ci?: number | null;
  @IsOptional() @IsInt() @Min(0) ru?: number | null;
  @IsOptional() @IsInt() @Min(0) paralelo?: number | null;
}

class ConvertirDto {
  @IsInt() @Min(1) materiaId!: number;
  // Filas crudas del archivo, tal como las devolvió /analizar.
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(MAX_FILAS_LISTA + 20)
  filas!: string[][];
  @IsInt() @Min(-1) filaEncabezado!: number;
  @ValidateNested() @Type(() => MapeoDto) mapeo!: MapeoDto;
  @IsOptional() @IsString() @MaxLength(10) paraleloPorDefecto?: string;
}

class RegistrarDto extends ListaDto {
  @IsOptional() @IsIn(['actualizar', 'omitir']) existentes?: 'actualizar' | 'omitir';
  @IsOptional() @IsBoolean() soyDocente?: boolean;
}

class EditarEstudianteDto {
  @IsOptional() @IsString() @MaxLength(60) apellidoPaterno?: string;
  @IsOptional() @IsString() @MaxLength(60) apellidoMaterno?: string;
  @IsOptional() @IsString() @MaxLength(80) nombres?: string;
  @IsOptional() @IsString() @MaxLength(20) ci?: string;
  @IsOptional() @IsString() @MaxLength(20) ru?: string;
  @IsOptional() @IsInt() @Min(1) paraleloId?: number;
}

class EstadoDto {
  @IsBoolean() activo!: boolean;
}

class ResolverSolicitudDto {
  // Al aceptar: paralelo distinto al pedido (opcional).
  @IsOptional() @IsInt() @Min(1)
  paraleloId?: number;

  // Al rechazar: qué se le dice al estudiante (opcional).
  @IsOptional() @IsString() @MaxLength(300)
  motivo?: string;
}

/** Registro de estudiantes del docente: materias, paralelos, carga de la lista y edición. */
@Controller('docente/registro')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('docente', 'admin')
export class DocenteRegistroController {
  constructor(private readonly service: DocenteRegistroService) {}

  // ── Solicitudes de estudiantes que se registraron por su cuenta ──
  @Get('solicitudes')
  solicitudes(@CurrentUser() u: { sub: number; rol: string }) {
    return this.service.solicitudes(u.sub, u.rol);
  }

  @Get('solicitudes/conteo')
  conteoSolicitudes(@CurrentUser() u: { sub: number; rol: string }) {
    return this.service.conteoSolicitudes(u.sub, u.rol);
  }

  @Post('solicitudes/:id/aceptar')
  aceptar(@CurrentUser() u: { sub: number; rol: string }, @Param('id', ParseIntPipe) id: number, @Body() dto: ResolverSolicitudDto) {
    return this.service.aceptarSolicitud(id, u.sub, u.rol, dto.paraleloId);
  }

  @Post('solicitudes/:id/rechazar')
  rechazar(@CurrentUser() u: { sub: number; rol: string }, @Param('id', ParseIntPipe) id: number, @Body() dto: ResolverSolicitudDto) {
    return this.service.rechazarSolicitud(id, u.sub, u.rol, dto.motivo);
  }

  @Get('materias')
  async materias(@CurrentUser('sub') docenteId: number) {
    return { materias: await this.service.materias(docenteId) };
  }

  @Post('materias')
  crearMateria(@Body() dto: CrearMateriaDto) {
    return this.service.crearMateria(dto);
  }

  @Post('paralelos')
  crearParalelo(@CurrentUser('sub') docenteId: number, @Body() dto: CrearParaleloDto) {
    return this.service.crearParalelo(docenteId, dto);
  }

  @Patch('paralelos/:id/docente')
  asignarme(@CurrentUser('sub') docenteId: number, @Param('id', ParseIntPipe) id: number, @Body() dto: AsignarmeDto) {
    return this.service.asignarme(docenteId, id, dto.asignar);
  }

  @Get('plantilla.xlsx')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('Content-Disposition', 'attachment; filename="plantilla_estudiantes_prexi.xlsx"')
  async plantilla(@Res() res: Response) {
    res.send(await this.service.plantilla());
  }

  /** Lee el Excel/CSV y reconoce las columnas. No guarda nada. */
  @Post('analizar')
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: MAX_LISTA_BYTES } }))
  analizar(@UploadedFile() archivo?: { buffer: Buffer; originalname: string; size: number }) {
    return this.service.analizar(archivo);
  }

  /** Aplica el mapeo de columnas confirmado por el docente y devuelve la vista previa. */
  @Post('convertir')
  convertir(@Body() dto: ConvertirDto) {
    return this.service.convertir({
      materiaId: dto.materiaId, filas: dto.filas, filaEncabezado: dto.filaEncabezado,
      paraleloPorDefecto: dto.paraleloPorDefecto,
      mapeo: {
        apellidoPaterno: dto.mapeo.apellidoPaterno ?? null, apellidoMaterno: dto.mapeo.apellidoMaterno ?? null,
        nombres: dto.mapeo.nombres ?? null, nombreCompleto: dto.mapeo.nombreCompleto ?? null,
        ci: dto.mapeo.ci ?? null, ru: dto.mapeo.ru ?? null, paralelo: dto.mapeo.paralelo ?? null,
      },
    });
  }

  /** Vista previa: valida las filas contra el archivo y contra la base. No guarda nada. */
  @Post('previsualizar')
  previsualizar(@Body() dto: ListaDto) {
    return this.service.previsualizar(dto.materiaId, dto.filas);
  }

  @Post('registrar')
  registrar(@CurrentUser('sub') docenteId: number, @Body() dto: RegistrarDto) {
    return this.service.registrar(docenteId, dto);
  }

  @Patch('estudiantes/:id')
  editar(
    @CurrentUser('sub') docenteId: number, @CurrentUser('rol') rol: string,
    @Param('id', ParseIntPipe) id: number, @Body() dto: EditarEstudianteDto,
  ) {
    return this.service.editar(docenteId, rol, id, dto);
  }

  @Patch('estudiantes/:id/estado')
  estado(
    @CurrentUser('sub') docenteId: number, @CurrentUser('rol') rol: string,
    @Param('id', ParseIntPipe) id: number, @Body() dto: EstadoDto,
  ) {
    return this.service.cambiarEstado(docenteId, rol, id, dto.activo);
  }

  @Post('estudiantes/:id/restablecer-acceso')
  restablecer(
    @CurrentUser('sub') docenteId: number, @CurrentUser('rol') rol: string, @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.restablecerAcceso(docenteId, rol, id);
  }
}
