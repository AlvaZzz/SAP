import { Module } from '@nestjs/common';
import { AdminUsuariosController } from './admin-usuarios.controller';
import { AdminUsuariosService } from './admin-usuarios.service';
import { AuthModule } from '../../auth/auth.module';
import { AdminAuditoriaModule } from '../admin-auditoria/admin-auditoria.module';

@Module({
  imports: [AuthModule, AdminAuditoriaModule],
  controllers: [AdminUsuariosController],
  providers: [AdminUsuariosService],
  exports: [AdminUsuariosService],
})
export class AdminUsuariosModule {}
