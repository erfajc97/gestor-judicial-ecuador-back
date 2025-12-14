import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MetricsModule } from '../metrics/metrics.module';
import { EmailModule } from '../email/email.module';
import { TelegramModule } from '../telegram/telegram.module';
import { ExperimentsService } from './experiments.service';
import { ExperimentsRunnerService } from './experiments-runner.service';
import { ExperimentsController } from './experiments.controller';

@Module({
  imports: [PrismaModule, MetricsModule, EmailModule, TelegramModule],
  providers: [ExperimentsService, ExperimentsRunnerService],
  controllers: [ExperimentsController],
  exports: [ExperimentsService],
})
export class ExperimentsModule {}
