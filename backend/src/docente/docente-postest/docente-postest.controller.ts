import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { IsBoolean, IsString, MaxLength, MinLength } from 'class-validator';
import { DocentePostestService } from './docente-postest.service';
import { JwtAuthGuard } from '../../common/auth/jwt.guard';
import { RolesGuard, Roles } from '../../common/auth/roles.guard';

class ControlPostestDto {
  @IsString() @MinLength(1) @MaxLength(10)
  paralelo!: string;

  @IsBoolean()
  habilitado!: boolean;
}

/** Rutas /docente/postest — control de la evaluación final por paralelo. SOLO docente/admin. */
@Controller('docente/postest')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('docente', 'admin')
export class DocentePostestController {
  constructor(private readonly service: DocentePostestService) {}

  @Get()
  async listar() {
    return { paralelos: await this.service.listar() };
  }

  @Post()
  async establecer(@Body() dto: ControlPostestDto) {
    return this.service.establecer(dto.paralelo, dto.habilitado);
  }
}
