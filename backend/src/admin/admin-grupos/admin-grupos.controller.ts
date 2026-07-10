import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { AdminGruposService } from './admin-grupos.service';
import { AsignarGrupoDto, AsignarGrupoParaleloDto } from './dto/grupo.dto';
import { JwtAuthGuard } from '../../common/auth/jwt.guard';
import { RolesGuard, Roles } from '../../common/auth/roles.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';

@Controller('admin/grupos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminGruposController {
  constructor(private readonly service: AdminGruposService) {}

  @Get()
  listar() {
    return this.service.listar();
  }

  @Post('asignar')
  asignar(@CurrentUser('sub') actorId: number, @Body() dto: AsignarGrupoDto) {
    return this.service.asignar(actorId, dto);
  }

  @Post('asignar-paralelo')
  asignarPorParalelo(@CurrentUser('sub') actorId: number, @Body() dto: AsignarGrupoParaleloDto) {
    return this.service.asignarPorParalelo(actorId, dto);
  }
}
