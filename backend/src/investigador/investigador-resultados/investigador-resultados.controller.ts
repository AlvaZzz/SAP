import { Controller, Get, UseGuards } from '@nestjs/common';
import { InvestigadorResultadosService } from './investigador-resultados.service';
import { JwtAuthGuard } from '../../common/auth/jwt.guard';
import { RolesGuard, Roles } from '../../common/auth/roles.guard';

@Controller('investigador/resultados')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('investigador', 'admin')
export class InvestigadorResultadosController {
  constructor(private readonly service: InvestigadorResultadosService) {}

  @Get()
  resumen() {
    return this.service.resumen();
  }
}
