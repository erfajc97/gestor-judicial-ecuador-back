import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotificationChannel,
  MetricStatus,
} from '../../generated/prisma/enums';
import {
  EconomicImpactDefaultsDto,
  CalculateEconomicImpactDto,
  EconomicImpactResultDto,
} from './dto/economic-impact.dto';

export interface MetricsSummaryDto {
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  successRate: number;
  p50LatencyMs: number | null;
  p95LatencyMs: number | null;
  p99LatencyMs: number | null;
  avgLatencyMs: number | null;
  byChannel: {
    channel: NotificationChannel;
    totalSent: number;
    totalDelivered: number;
    totalFailed: number;
    successRate: number;
    p95LatencyMs: number | null;
  }[];
}

export interface MetricsLogsQueryDto {
  from?: Date;
  to?: Date;
  channel?: NotificationChannel;
  status?: MetricStatus;
  q?: string; // search in correlationId, recipientHash, template
  page?: number;
  pageSize?: number;
  experimentRunId?: string;
}

export interface MetricsLatencyDto {
  series: Array<{
    timestamp: Date;
    p50: number | null;
    p95: number | null;
    p99: number | null;
    avg: number | null;
  }>;
  seriesByChannel: Array<{
    timestamp: Date;
    channel: NotificationChannel;
    p95: number | null;
  }>;
  overall: {
    p50: number | null;
    p95: number | null;
    p99: number | null;
    avg: number | null;
  };
  byChannel: {
    channel: NotificationChannel;
    p50: number | null;
    p95: number | null;
    p99: number | null;
    avg: number | null;
  }[];
}

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Calcula percentiles de un array de números
   */
  private calculatePercentiles(
    values: number[],
  ): { p50: number; p95: number; p99: number; avg: number } | null {
    if (values.length === 0) {
      return null;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    const avg = sorted.reduce((sum, val) => sum + val, 0) / sorted.length;

    return { p50, p95, p99, avg };
  }

  /**
   * Obtiene resumen de métricas (KPIs)
   */
  async getSummary(
    from?: Date,
    to?: Date,
    channel?: NotificationChannel,
    experimentRunId?: string,
  ): Promise<MetricsSummaryDto> {
    const where: {
      channel?: NotificationChannel;
      experimentRunId?: string;
      createdAt?: { gte?: Date; lte?: Date };
    } = {};

    // Solo aplicar filtro de canal si está especificado y no es "Todos"
    if (channel && channel !== NotificationChannel.BOTH) {
      where.channel = channel;
    }

    // Aplicar filtro de experimento si está especificado
    if (experimentRunId && experimentRunId.trim() !== '') {
      where.experimentRunId = experimentRunId;
    }

    // Solo aplicar filtro de fecha si ambas fechas están especificadas
    if (from && to) {
      where.createdAt = {
        gte: from,
        lte: to,
      };
    } else if (from) {
      where.createdAt = { gte: from };
    } else if (to) {
      where.createdAt = { lte: to };
    }

    this.logger.debug(
      `getSummary called with filters: ${JSON.stringify({ from, to, channel, experimentRunId })}`,
    );
    this.logger.debug(`getSummary where clause: ${JSON.stringify(where)}`);

    const allEvents =
      (await // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      (this.prisma as any).notificationMetricEvent.findMany({
        where,
        select: {
          channel: true,
          status: true,
          latencyMs: true,
        },
      })) as Array<{
        channel: NotificationChannel;
        status: MetricStatus;
        latencyMs: number | null;
      }>;

    this.logger.debug(`getSummary found ${allEvents.length} events`);
    if (allEvents.length === 0) {
      this.logger.warn(
        `No events found with filters. This might indicate: 1) No data in database, 2) Filters too restrictive, 3) Date range excludes all data`,
      );
    }

    // Log distribución de estados para debugging
    const statusCounts = allEvents.reduce(
      (acc: Record<string, number>, e: { status: MetricStatus }) => {
        acc[e.status] = (acc[e.status] || 0) + 1;
        return acc;
      },
      {},
    );
    this.logger.debug(
      `getSummary status distribution: ${JSON.stringify(statusCounts)}`,
    );

    // Incluir PENDING en el conteo de enviados (ya que fueron iniciados)
    const totalSent = allEvents.filter(
      (e: { status: MetricStatus }) =>
        e.status === MetricStatus.PENDING ||
        e.status === MetricStatus.SENT ||
        e.status === MetricStatus.ACKED ||
        e.status === MetricStatus.DELIVERED ||
        e.status === MetricStatus.FAILED,
    ).length;

    const totalDelivered = allEvents.filter(
      (e: { status: MetricStatus }) => e.status === MetricStatus.DELIVERED,
    ).length;

    const totalFailed = allEvents.filter(
      (e: { status: MetricStatus }) => e.status === MetricStatus.FAILED,
    ).length;

    const successRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;

    // Calcular latencias
    const latencies = allEvents
      .map((e: { latencyMs: number | null }) => e.latencyMs)
      .filter((l: number | null): l is number => l !== null && l !== undefined);

    const percentiles = this.calculatePercentiles(latencies);

    // Agregar por canal - solo mostrar canales que tienen datos y excluir BOTH
    const channelsWithData = new Set(
      allEvents.map((e: { channel: NotificationChannel }) => e.channel),
    );
    const byChannel = Array.from(channelsWithData)
      .filter((ch) => ch !== NotificationChannel.BOTH) // Excluir BOTH ya que no es un canal real
      .map((ch) => {
        const channelEvents = allEvents.filter(
          (e: { channel: NotificationChannel }) => e.channel === ch,
        );
        const channelSent = channelEvents.filter(
          (e: { status: MetricStatus }) =>
            e.status === MetricStatus.PENDING ||
            e.status === MetricStatus.SENT ||
            e.status === MetricStatus.ACKED ||
            e.status === MetricStatus.DELIVERED ||
            e.status === MetricStatus.FAILED,
        ).length;
        const channelDelivered = channelEvents.filter(
          (e: { status: MetricStatus }) => e.status === MetricStatus.DELIVERED,
        ).length;
        const channelFailed = channelEvents.filter(
          (e: { status: MetricStatus }) => e.status === MetricStatus.FAILED,
        ).length;
        const channelSuccessRate =
          channelSent > 0 ? (channelDelivered / channelSent) * 100 : 0;

        const channelLatencies = channelEvents
          .map((e: { latencyMs: number | null }) => e.latencyMs)
          .filter(
            (l: number | null): l is number => l !== null && l !== undefined,
          );
        const channelPercentiles = this.calculatePercentiles(channelLatencies);

        return {
          channel: ch,
          totalSent: channelSent,
          totalDelivered: channelDelivered,
          totalFailed: channelFailed,
          successRate: channelSuccessRate,
          p95LatencyMs: channelPercentiles?.p95 ?? null,
        };
      });

    return {
      totalSent,
      totalDelivered,
      totalFailed,
      successRate,
      p50LatencyMs: percentiles?.p50 ?? null,
      p95LatencyMs: percentiles?.p95 ?? null,
      p99LatencyMs: percentiles?.p99 ?? null,
      avgLatencyMs: percentiles?.avg ?? null,
      byChannel,
    };
  }

  /**
   * Obtiene logs de métricas con paginación
   */
  async getLogs(query: MetricsLogsQueryDto): Promise<{
    data: unknown[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const where: {
      channel?: NotificationChannel;
      status?: MetricStatus;
      experimentRunId?: string;
      createdAt?: { gte?: Date; lte?: Date };
      OR?: Array<{
        correlationId?: { contains: string; mode: 'insensitive' };
        recipientHash?: { contains: string; mode: 'insensitive' };
        template?: { contains: string; mode: 'insensitive' };
      }>;
    } = {};

    // Solo aplicar filtro de canal si está especificado y no es "Todos"
    if (query.channel && query.channel !== NotificationChannel.BOTH) {
      where.channel = query.channel;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.experimentRunId && query.experimentRunId.trim() !== '') {
      where.experimentRunId = query.experimentRunId;
    }

    // Mejorar manejo de fechas
    if (query.from && query.to) {
      where.createdAt = {
        gte: query.from,
        lte: query.to,
      };
    } else if (query.from) {
      where.createdAt = { gte: query.from };
    } else if (query.to) {
      where.createdAt = { lte: query.to };
    }

    this.logger.debug(`getLogs called with filters: ${JSON.stringify(query)}`);

    if (query.q) {
      where.OR = [
        { correlationId: { contains: query.q, mode: 'insensitive' } },
        { recipientHash: { contains: query.q, mode: 'insensitive' } },
        { template: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    this.logger.debug(`getLogs where clause: ${JSON.stringify(where)}`);

    const page = query.page || 1;
    const pageSize = query.pageSize || 50;
    const skip = (page - 1) * pageSize;

    const [data, total] = (await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      (this.prisma as any).notificationMetricEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: pageSize,
        skip,
      }),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      (this.prisma as any).notificationMetricEvent.count({ where }),
    ])) as [unknown[], number];

    this.logger.debug(
      `getLogs found ${total} total events, returning ${data.length} on page ${page}`,
    );

    return {
      data,
      total,
      page,
      pageSize,
    };
  }

  /**
   * Obtiene métricas de latencia con series temporales
   */
  async getLatency(
    from?: Date,
    to?: Date,
    channel?: NotificationChannel,
    experimentRunId?: string,
  ): Promise<MetricsLatencyDto> {
    const where: {
      channel?: NotificationChannel;
      experimentRunId?: string;
      createdAt?: { gte?: Date; lte?: Date };
      latencyMs?: { not: null };
    } = {
      latencyMs: { not: null },
    };

    // Solo aplicar filtro de canal si está especificado y no es "Todos"
    if (channel && channel !== NotificationChannel.BOTH) {
      where.channel = channel;
    }

    // Aplicar filtro de experimento si está especificado
    if (experimentRunId && experimentRunId.trim() !== '') {
      where.experimentRunId = experimentRunId;
    }

    // Mejorar manejo de fechas
    if (from && to) {
      where.createdAt = {
        gte: from,
        lte: to,
      };
    } else if (from) {
      where.createdAt = { gte: from };
    } else if (to) {
      where.createdAt = { lte: to };
    }

    this.logger.debug(
      `getLatency called with filters: ${JSON.stringify({ from, to, channel, experimentRunId })}`,
    );
    const events =
      (await // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      (this.prisma as any).notificationMetricEvent.findMany({
        where,
        select: {
          channel: true,
          latencyMs: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      })) as Array<{
        channel: NotificationChannel;
        latencyMs: number;
        createdAt: Date | string;
      }>;

    this.logger.debug(`getLatency found ${events.length} events with latency`);

    // Determinar intervalo de agrupación: si hay experimentRunId, usar segundos; si no, usar horas
    const useSecondPrecision =
      !!experimentRunId && experimentRunId.trim() !== '';

    // Agrupar por intervalo (segundo o hora) para series temporales
    const seriesMap = new Map<string, number[]>();
    events.forEach((e) => {
      const createdAtDate =
        e.createdAt instanceof Date ? e.createdAt : new Date(e.createdAt);
      let timeKey: string;
      if (useSecondPrecision) {
        // Agrupar por segundo cuando hay experimentRunId
        timeKey = createdAtDate.toISOString().slice(0, 19); // YYYY-MM-DDTHH:mm:ss
      } else {
        // Agrupar por hora para datos generales
        timeKey = createdAtDate.toISOString().slice(0, 13) + ':00:00';
      }
      if (!seriesMap.has(timeKey)) {
        seriesMap.set(timeKey, []);
      }
      const timeLatencies = seriesMap.get(timeKey);
      if (timeLatencies) {
        timeLatencies.push(e.latencyMs);
      }
    });

    const series = Array.from(seriesMap.entries())
      .map(([timestamp, latencies]) => {
        const percentiles = this.calculatePercentiles(latencies);
        return {
          timestamp: new Date(timestamp),
          p50: percentiles?.p50 ?? null,
          p95: percentiles?.p95 ?? null,
          p99: percentiles?.p99 ?? null,
          avg: percentiles?.avg ?? null,
        };
      })
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Agrupar por intervalo (segundo o hora) y canal para series comparativas
    const seriesByChannelMap = new Map<
      string,
      Map<NotificationChannel, number[]>
    >();
    events.forEach((e) => {
      const createdAtDate =
        e.createdAt instanceof Date ? e.createdAt : new Date(e.createdAt);
      let timeKey: string;
      if (useSecondPrecision) {
        // Agrupar por segundo cuando hay experimentRunId
        timeKey = createdAtDate.toISOString().slice(0, 19); // YYYY-MM-DDTHH:mm:ss
      } else {
        // Agrupar por hora para datos generales
        timeKey = createdAtDate.toISOString().slice(0, 13) + ':00:00';
      }
      if (!seriesByChannelMap.has(timeKey)) {
        seriesByChannelMap.set(timeKey, new Map());
      }
      const channelMap = seriesByChannelMap.get(timeKey);
      if (channelMap) {
        if (!channelMap.has(e.channel)) {
          channelMap.set(e.channel, []);
        }
        const channelLatencies = channelMap.get(e.channel);
        if (channelLatencies) {
          channelLatencies.push(e.latencyMs);
        }
      }
    });

    const seriesByChannel: Array<{
      timestamp: Date;
      channel: NotificationChannel;
      p95: number | null;
    }> = [];
    seriesByChannelMap.forEach((channelMap, timestamp) => {
      channelMap.forEach((latencies, channel) => {
        if (channel !== NotificationChannel.BOTH) {
          const percentiles = this.calculatePercentiles(latencies);
          seriesByChannel.push({
            timestamp: new Date(timestamp),
            channel,
            p95: percentiles?.p95 ?? null,
          });
        }
      });
    });
    seriesByChannel.sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );

    // Calcular overall
    const allLatencies = events.map((e) => e.latencyMs);
    const overall = this.calculatePercentiles(allLatencies);

    // Calcular por canal - solo mostrar canales que tienen datos y excluir BOTH
    const channelsWithData = new Set(events.map((e) => e.channel));
    const byChannel = Array.from(channelsWithData)
      .filter((ch) => ch !== NotificationChannel.BOTH) // Excluir BOTH ya que no es un canal real
      .map((ch) => {
        const channelLatencies = events
          .filter((e) => e.channel === ch)
          .map((e) => e.latencyMs);
        const channelPercentiles = this.calculatePercentiles(channelLatencies);
        return {
          channel: ch,
          p50: channelPercentiles?.p50 ?? null,
          p95: channelPercentiles?.p95 ?? null,
          p99: channelPercentiles?.p99 ?? null,
          avg: channelPercentiles?.avg ?? null,
        };
      });

    return {
      series,
      seriesByChannel,
      overall: {
        p50: overall?.p50 ?? null,
        p95: overall?.p95 ?? null,
        p99: overall?.p99 ?? null,
        avg: overall?.avg ?? null,
      },
      byChannel,
    };
  }

  /**
   * Obtiene throughput (mensajes por segundo) para un experimento
   */
  async getThroughput(experimentRunId: string): Promise<
    Array<{
      tOffsetSec: number;
      sentCount: number;
      successCount: number;
      failCount: number;
      throughput: number; // mensajes/segundo
    }>
  > {
    const seriesPoints =
      (await // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      (this.prisma as any).experimentSeriesPoint.findMany({
        where: { experimentRunId },
        orderBy: { tOffsetSec: 'asc' },
      })) as Array<{
        tOffsetSec: number;
        sentCount: number;
        successCount: number;
        failCount: number;
      }>;

    // Calcular throughput real por segundo (diferencia entre puntos consecutivos)
    return seriesPoints.map(
      (
        point: {
          tOffsetSec: number;
          sentCount: number;
          successCount: number;
          failCount: number;
        },
        index: number,
      ) => {
        let throughput = 0;
        if (index === 0) {
          // Primer punto: throughput es el total enviado hasta ese momento
          throughput = point.sentCount;
        } else {
          // Puntos siguientes: throughput es la diferencia con el punto anterior
          const prevPoint = seriesPoints[index - 1];
          const timeDiff = point.tOffsetSec - prevPoint.tOffsetSec;
          if (timeDiff > 0) {
            throughput = (point.sentCount - prevPoint.sentCount) / timeDiff;
          } else {
            // Si están en el mismo segundo, usar el acumulado
            throughput = point.sentCount - prevPoint.sentCount;
          }
        }

        return {
          tOffsetSec: point.tOffsetSec,
          sentCount: point.sentCount,
          successCount: point.successCount,
          failCount: point.failCount,
          throughput: Math.max(0, throughput), // Asegurar que no sea negativo
        };
      },
    );
  }

  /**
   * Obtiene los valores por defecto para el modelo económico
   */
  getEconomicDefaults(): EconomicImpactDefaultsDto {
    return {
      annualFailedHearings: 75363,
      averageCostPerHearing: 339.04,
      reductionScenarios: {
        veryConservative: 10,
        mediumConservative: 20,
        moderatelyConservative: 30,
      },
    };
  }

  /**
   * Calcula el impacto económico basado en parámetros
   */
  calculateEconomicImpact(
    dto: CalculateEconomicImpactDto,
  ): EconomicImpactResultDto {
    const avoidedCancellations = Math.round(
      dto.annualFailedHearings * (dto.reductionPercentage / 100),
    );
    const estimatedAnnualSavings =
      Math.round(avoidedCancellations * dto.averageCostPerHearing * 100) / 100; // Redondear a 2 decimales

    return {
      reductionPercentage: dto.reductionPercentage,
      avoidedCancellations,
      estimatedAnnualSavings,
      inputs: {
        annualFailedHearings: dto.annualFailedHearings,
        averageCostPerHearing: dto.averageCostPerHearing,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
