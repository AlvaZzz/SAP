import { Module } from '@nestjs/common';
import { AdminConfigController } from './admin-config.controller';
import { AdminConfigService } from './admin-config.service';
import { AuthModule } from '../../auth/auth.module';
import { AdminAuditoriaModule } from '../admin-auditoria/admin-auditoria.module';

@Module({
  imports: [AuthModule, AdminAuditoriaModule],
  controllers: [AdminConfigController],
  providers: [AdminConfigService],
})
export class AdminConfigModule {}
