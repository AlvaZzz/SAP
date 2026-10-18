import { Module } from '@nestjs/common';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { AuthModule } from '../../auth/auth.module';
import { AdminUsuariosModule } from '../admin-usuarios/admin-usuarios.module';
import { AdminAuditoriaModule } from '../admin-auditoria/admin-auditoria.module';
import { AdminContenidoModule } from '../admin-contenido/admin-contenido.module';

@Module({
  imports: [AuthModule, AdminUsuariosModule, AdminAuditoriaModule, AdminContenidoModule],
  controllers: [AdminDashboardController],
  providers: [AdminDashboardService],
})
export class AdminDashboardModule {}
