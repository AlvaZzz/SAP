import { Module } from '@nestjs/common';
import { RetosController } from './retos.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [RetosController],
})
export class RetosModule {}
