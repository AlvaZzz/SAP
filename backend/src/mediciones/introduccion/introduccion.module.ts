import { Module } from '@nestjs/common';
import { IntroduccionController } from './introduccion.controller';
import { IntroduccionService } from './introduccion.service';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [IntroduccionController],
  providers: [IntroduccionService],
  exports: [IntroduccionService],
})
export class IntroduccionModule {}
