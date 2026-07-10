import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/** Disponible globalmente: cualquier módulo puede inyectar PrismaService. */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
