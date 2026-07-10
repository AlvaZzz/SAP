import { Controller, Get, UseGuards } from '@nestjs/common';
import { InvestigadorPanelService } from './investigador-panel.service';
import { JwtAuthGuard } from '../../common/auth/jwt.guard';
import { RolesGuard, Roles } from '../../common/auth/roles.guard';

@Controller('investigador/panel')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('investigador', 'admin')
export class InvestigadorPanelController {
  constructor(private readonly service: InvestigadorPanelService) {}

  @Get()
  resumen() {
    return this.service.resumen();
  }
}
