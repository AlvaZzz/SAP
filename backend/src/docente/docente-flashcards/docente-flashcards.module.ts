import { Module } from '@nestjs/common';
import { DocenteFlashcardsController } from './docente-flashcards.controller';
import { DocenteFlashcardsService } from './docente-flashcards.service';
import { AuthModule } from '../../auth/auth.module';
import { TutorIaModule } from '../../tutor-ia/tutor-ia.module';

@Module({
  imports: [AuthModule, TutorIaModule],
  controllers: [DocenteFlashcardsController],
  providers: [DocenteFlashcardsService],
})
export class DocenteFlashcardsModule {}
