import { Controller, Get, UseGuards } from '@nestjs/common';
import { InvestigadorDatosService } from './investigador-datos.service';
import { JwtAuthGuard } from '../../common/auth/jwt.guard';
import { RolesGuard, Roles } from '../../common/auth/roles.guard';

@Controller('investigador/datos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('investigador', 'admin')
export class InvestigadorDatosController {
  constructor(private readonly service: InvestigadorDatosService) {}

  @Get()
  relacion() {
    return this.service.relacion();
  }
}
