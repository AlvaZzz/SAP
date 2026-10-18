import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth/jwt.guard';
import { RolesGuard, Roles } from '../../common/auth/roles.guard';
import { AdminContenidoService } from './admin-contenido.service';

@Controller('admin/contenido')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminContenidoController {
  constructor(private readonly service: AdminContenidoService) {}

  @Get()
  resumen() {
    return this.service.resumen();
  }
}
