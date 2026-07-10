import { Module } from '@nestjs/common';
import { PostestController } from './postest.controller';
import { PostestService } from './postest.service';
import { AuthModule } from '../../auth/auth.module';
import { GamificacionModule } from '../../gamificacion/gamificacion.module';

@Module({
  imports: [AuthModule, GamificacionModule],
  controllers: [PostestController],
  providers: [PostestService],
  exports: [PostestService],
})
export class PostestModule {}
