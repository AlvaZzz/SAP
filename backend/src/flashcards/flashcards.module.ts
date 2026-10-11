import { Module } from '@nestjs/common';
import { FlashcardsController } from './flashcards.controller';
import { FlashcardsService } from './flashcards.service';
import { AuthModule } from '../auth/auth.module';

/**
 * Flashcards: apoyo al estudio (repaso libre). Deriva las tarjetas del banco de
 * ejercicios existente y NO altera métricas de medición (pretest/postest/θ).
 */
@Module({
  imports: [AuthModule], // JwtModule para el guard
  controllers: [FlashcardsController],
  providers: [FlashcardsService],
})
export class FlashcardsModule {}
