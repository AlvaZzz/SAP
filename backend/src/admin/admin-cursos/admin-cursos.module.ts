import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { AdminAuditoriaModule } from '../admin-auditoria/admin-auditoria.module';
import { AdminCursosController } from './admin-cursos.controller';
import { AdminCursosService } from './admin-cursos.service';

@Module({
  imports: [AuthModule, AdminAuditoriaModule],
  controllers: [AdminCursosController],
  providers: [AdminCursosService],
})
export class AdminCursosModule {}
