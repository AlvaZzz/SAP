import { Module } from '@nestjs/common';
import { DocumentosController } from './documentos.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [DocumentosController],
})
export class DocumentosModule {}
