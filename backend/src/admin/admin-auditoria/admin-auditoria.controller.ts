import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminAuditoriaService } from './admin-auditoria.service';
import { JwtAuthGuard } from '../../common/auth/jwt.guard';
import { RolesGuard, Roles } from '../../common/auth/roles.guard';

@Controller('admin/auditoria')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminAuditoriaController {
  constructor(private readonly service: AdminAuditoriaService) {}

  @Get()
  listar(
    @Query('accion') accion?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.listar({
      accion: accion || undefined,
      desde: desde || undefined,
      hasta: hasta || undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }
}
