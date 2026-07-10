import { Module } from '@nestjs/common';
import { RankingController } from './ranking.controller';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [RankingController],
})
export class RankingModule {}
