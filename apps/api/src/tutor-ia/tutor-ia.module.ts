import { Module } from '@nestjs/common';
import { TutorIaController } from './tutor-ia.controller';
import { TutorIaService } from './tutor-ia.service';
import { AiRateLimitGuard } from '../common/auth/ai-rate-limit.guard';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [TutorIaController],
  providers: [TutorIaService, AiRateLimitGuard],
  exports: [TutorIaService],
})
export class TutorIaModule {}
