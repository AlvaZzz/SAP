import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { EjerciciosModule } from './ejercicios/ejercicios.module';
import { PretestModule } from './pretest/pretest.module';
import { TutorIaModule } from './tutor-ia/tutor-ia.module';
import { PracticaModule } from './practica/practica.module';

/**
 * Módulo raíz. Cada dominio (Screaming Architecture) se importa aquí:
 * auth, pretest, ejercicios, practica, tutor-ia, documentos, retos,
 * ranking, progreso, gamificacion. Se irán agregando por fase.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    EjerciciosModule,
    PretestModule,
    TutorIaModule,
    PracticaModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
