import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './auth/auth.module';

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
  ],
})
export class AppModule {}
