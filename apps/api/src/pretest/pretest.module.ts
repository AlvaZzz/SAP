import { Module } from '@nestjs/common';
import { PretestController } from './pretest.controller';
import { PretestService } from './pretest.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [PretestController],
  providers: [PretestService],
  exports: [PretestService],
})
export class PretestModule {}
