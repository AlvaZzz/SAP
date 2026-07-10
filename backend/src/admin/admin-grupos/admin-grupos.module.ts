import { Module } from '@nestjs/common';
import { AdminGruposController } from './admin-grupos.controller';
import { AdminGruposService } from './admin-grupos.service';
import { AuthModule } from '../../auth/auth.module';
import { AdminAuditoriaModule } from '../admin-auditoria/admin-auditoria.module';

@Module({
  imports: [AuthModule, AdminAuditoriaModule],
  controllers: [AdminGruposController],
  providers: [AdminGruposService],
})
export class AdminGruposModule {}
