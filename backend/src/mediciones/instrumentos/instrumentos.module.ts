import { Module } from '@nestjs/common';
import { InstrumentosController } from './instrumentos.controller';
import { InstrumentosService } from './instrumentos.service';
import { AuthModule } from '../../auth/auth.module';

/** Instrumentos de valoración del estudio: SUS e ISO/IEC 25010. */
@Module({
  imports: [AuthModule], // JwtModule para los guards
  controllers: [InstrumentosController],
  providers: [InstrumentosService],
  exports: [InstrumentosService],
})
export class InstrumentosModule {}
