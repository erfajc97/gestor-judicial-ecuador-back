import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MetricsRecorderService } from './metrics-recorder.service';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';

@Module({
  imports: [PrismaModule],
  providers: [MetricsRecorderService, MetricsService],
  controllers: [MetricsController],
  exports: [MetricsRecorderService, MetricsService],
})
export class MetricsModule {}
