import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { AdminContenidoController } from './admin-contenido.controller';
import { AdminContenidoService } from './admin-contenido.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminContenidoController],
  providers: [AdminContenidoService],
  exports: [AdminContenidoService],
})
export class AdminContenidoModule {}
