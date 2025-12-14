import { Controller, Get, Post, Query, Body } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import {
  MetricsSummaryQueryDto,
  MetricsLogsQueryDto,
  MetricsLatencyQueryDto,
  MetricsThroughputQueryDto,
} from './dto/metrics-query.dto';
import {
  EconomicImpactDefaultsDto,
  CalculateEconomicImpactDto,
  EconomicImpactResultDto,
} from './dto/economic-impact.dto';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('summary')
  async getSummary(@Query() query: MetricsSummaryQueryDto) {
    // Convertir fechas de datetime-local a Date, manejando timezone correctamente
    const from =
      query.from && query.from.trim() !== '' ? new Date(query.from) : undefined;
    const to =
      query.to && query.to.trim() !== '' ? new Date(query.to) : undefined;

    // Validar que las fechas sean válidas
    if (from && isNaN(from.getTime())) {
      throw new Error('Invalid "from" date format');
    }
    if (to && isNaN(to.getTime())) {
      throw new Error('Invalid "to" date format');
    }

    return this.metricsService.getSummary(
      from,
      to,
      query.channel,
      query.experimentRunId,
    );
  }

  @Get('logs')
  async getLogs(@Query() query: MetricsLogsQueryDto) {
    // Convertir fechas de datetime-local a Date, manejando timezone correctamente
    const from =
      query.from && query.from.trim() !== '' ? new Date(query.from) : undefined;
    const to =
      query.to && query.to.trim() !== '' ? new Date(query.to) : undefined;

    // Validar que las fechas sean válidas
    if (from && isNaN(from.getTime())) {
      throw new Error('Invalid "from" date format');
    }
    if (to && isNaN(to.getTime())) {
      throw new Error('Invalid "to" date format');
    }

    return this.metricsService.getLogs({
      from,
      to,
      channel: query.channel,
      status: query.status,
      q: query.q,
      page: query.page,
      pageSize: query.pageSize,
      experimentRunId: query.experimentRunId,
    });
  }

  @Get('latency')
  async getLatency(@Query() query: MetricsLatencyQueryDto) {
    // Convertir fechas de datetime-local a Date, manejando timezone correctamente
    const from =
      query.from && query.from.trim() !== '' ? new Date(query.from) : undefined;
    const to =
      query.to && query.to.trim() !== '' ? new Date(query.to) : undefined;

    // Validar que las fechas sean válidas
    if (from && isNaN(from.getTime())) {
      throw new Error('Invalid "from" date format');
    }
    if (to && isNaN(to.getTime())) {
      throw new Error('Invalid "to" date format');
    }

    return this.metricsService.getLatency(
      from,
      to,
      query.channel,
      query.experimentRunId,
    );
  }

  @Get('throughput')
  async getThroughput(@Query() query: MetricsThroughputQueryDto) {
    return this.metricsService.getThroughput(query.experimentRunId);
  }

  @Get('economic/defaults')
  getEconomicDefaults(): EconomicImpactDefaultsDto {
    return this.metricsService.getEconomicDefaults();
  }

  @Post('economic/calculate')
  calculateEconomicImpact(
    @Body() dto: CalculateEconomicImpactDto,
  ): EconomicImpactResultDto {
    return this.metricsService.calculateEconomicImpact(dto);
  }
}
