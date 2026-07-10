import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { AdminConfigService } from './admin-config.service';
import { ActualizarConfigDto } from './dto/config.dto';
import { JwtAuthGuard } from '../../common/auth/jwt.guard';
import { RolesGuard, Roles } from '../../common/auth/roles.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';

@Controller('admin/config')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminConfigController {
  constructor(private readonly service: AdminConfigService) {}

  @Get()
  obtener() {
    return this.service.obtener();
  }

  @Put()
  actualizar(@CurrentUser('sub') actorId: number, @Body() dto: ActualizarConfigDto) {
    return this.service.actualizar(actorId, dto);
  }
}
