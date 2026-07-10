import { Controller, Get, UseGuards } from '@nestjs/common';
import { UnidadesService } from './unidades.service';
import { JwtAuthGuard } from '../../common/auth/jwt.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';

@Controller('unidades')
@UseGuards(JwtAuthGuard)
export class UnidadesController {
  constructor(private readonly unidades: UnidadesService) {}

  @Get()
  async listar(@CurrentUser('sub') usuarioId: number) {
    return { unidades: await this.unidades.listar(usuarioId) };
  }
}
