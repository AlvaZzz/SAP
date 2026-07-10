import { Module } from '@nestjs/common';
import { AdminAuditoriaController } from './admin-auditoria.controller';
import { AdminAuditoriaService } from './admin-auditoria.service';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AdminAuditoriaController],
  providers: [AdminAuditoriaService],
  exports: [AdminAuditoriaService],
})
export class AdminAuditoriaModule {}
