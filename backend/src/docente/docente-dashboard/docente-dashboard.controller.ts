import { Controller, Get, UseGuards } from '@nestjs/common';
import { DocenteDashboardService } from './docente-dashboard.service';
import { JwtAuthGuard } from '../../common/auth/jwt.guard';
import { RolesGuard, Roles } from '../../common/auth/roles.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';

@Controller('docente/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('docente', 'admin')
export class DocenteDashboardController {
  constructor(private readonly service: DocenteDashboardService) {}

  @Get()
  resumen(@CurrentUser('sub') docenteId: number) {
    return this.service.resumen(docenteId);
  }
}
