import { Module } from '@nestjs/common';
import { DocenteDocumentosController } from './docente-documentos.controller';
import { DocenteDocumentosService } from './docente-documentos.service';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [DocenteDocumentosController],
  providers: [DocenteDocumentosService],
})
export class DocenteDocumentosModule {}
