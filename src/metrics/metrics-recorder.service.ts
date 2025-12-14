import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotificationChannel,
  MetricStatus,
} from '../../generated/prisma/enums';
import { randomUUID } from 'crypto';

export interface RecordMetricEventDto {
  channel: NotificationChannel;
  template?: string;
  recipientHash: string;
  correlationId?: string;
  experimentRunId?: string;
}

export interface UpdateMetricEventDto {
  correlationId: string;
  status: MetricStatus;
  providerAckAt?: Date;
  deliveredAt?: Date;
  latencyMs?: number;
  errorCode?: string;
  errorMessage?: string;
  retryCount?: number;
}

@Injectable()
export class MetricsRecorderService {
  private readonly logger = new Logger(MetricsRecorderService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Crea un nuevo evento de métrica en estado PENDING
   */
  async recordPendingEvent(dto: RecordMetricEventDto): Promise<string> {
    const correlationId = dto.correlationId || randomUUID();
    const sentAt = new Date();

    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await (this.prisma as any).notificationMetricEvent.create({
        data: {
          channel: dto.channel,
          template: dto.template,
          recipientHash: dto.recipientHash,
          correlationId,
          status: MetricStatus.PENDING,
          sentAt,
          experimentRunId: dto.experimentRunId,
        },
      });

      // Retornar correlationId para que pueda usarse en updateToAcked/updateToFailed
      return correlationId;
    } catch (error) {
      this.logger.error('Error al registrar evento PENDING:', error);
      // No lanzamos el error para no bloquear la operación principal
      return correlationId;
    }
  }

  /**
   * Actualiza un evento a SENT (cuando se envía pero aún no hay ACK)
   */
  async updateToSent(correlationId: string): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await (this.prisma as any).notificationMetricEvent.updateMany({
        where: { correlationId },
        data: {
          status: MetricStatus.SENT,
        },
      });
    } catch (error) {
      this.logger.error(
        `Error al actualizar evento a SENT (${correlationId}):`,
        error,
      );
    }
  }

  /**
   * Actualiza un evento a ACKED cuando el provider confirma recepción
   */
  async updateToAcked(dto: UpdateMetricEventDto): Promise<void> {
    try {
      const providerAckAt = dto.providerAckAt || new Date();
      const latencyMs = dto.latencyMs;

      // Si no se proporciona latencyMs, calcularlo desde sentAt
      let calculatedLatencyMs = latencyMs;
      if (!calculatedLatencyMs) {
        const existing =
          (await // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          (this.prisma as any).notificationMetricEvent.findFirst({
            where: { correlationId: dto.correlationId },
          })) as { sentAt: Date | string } | null;

        if (existing && existing.sentAt) {
          const sentAtDate =
            existing.sentAt instanceof Date
              ? existing.sentAt
              : new Date(existing.sentAt);
          calculatedLatencyMs = providerAckAt.getTime() - sentAtDate.getTime();
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await (this.prisma as any).notificationMetricEvent.updateMany({
        where: { correlationId: dto.correlationId },
        data: {
          status: MetricStatus.ACKED,
          providerAckAt,
          latencyMs: calculatedLatencyMs,
          retryCount: dto.retryCount,
        },
      });
    } catch (error) {
      this.logger.error(
        `Error al actualizar evento a ACKED (${dto.correlationId}):`,
        error,
      );
    }
  }

  /**
   * Actualiza un evento a DELIVERED
   */
  async updateToDelivered(
    correlationId: string,
    deliveredAt?: Date,
  ): Promise<void> {
    try {
      const delivered = deliveredAt || new Date();

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await (this.prisma as any).notificationMetricEvent.updateMany({
        where: { correlationId },
        data: {
          status: MetricStatus.DELIVERED,
          deliveredAt: delivered,
        },
      });
    } catch (error) {
      this.logger.error(
        `Error al actualizar evento a DELIVERED (${correlationId}):`,
        error,
      );
    }
  }

  /**
   * Actualiza un evento a FAILED con información del error
   */
  async updateToFailed(
    correlationId: string,
    errorCode: string,
    errorMessage: string,
    retryCount?: number,
  ): Promise<void> {
    try {
      const existing =
        (await // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        (this.prisma as any).notificationMetricEvent.findFirst({
          where: { correlationId },
        })) as { retryCount: number | null | undefined } | null;

      const currentRetryCount =
        retryCount !== undefined
          ? retryCount
          : existing
            ? (existing.retryCount || 0) + 1
            : 0;

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await (this.prisma as any).notificationMetricEvent.updateMany({
        where: { correlationId },
        data: {
          status: MetricStatus.FAILED,
          errorCode,
          errorMessage,
          retryCount: currentRetryCount,
        },
      });
    } catch (error) {
      this.logger.error(
        `Error al actualizar evento a FAILED (${correlationId}):`,
        error,
      );
    }
  }

  /**
   * Incrementa el contador de reintentos
   */
  async incrementRetryCount(correlationId: string): Promise<void> {
    try {
      const existing =
        (await // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        (this.prisma as any).notificationMetricEvent.findFirst({
          where: { correlationId },
        })) as { retryCount: number | null | undefined } | null;

      if (existing) {
        const currentRetryCount = existing.retryCount || 0;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        await (this.prisma as any).notificationMetricEvent.updateMany({
          where: { correlationId },
          data: {
            retryCount: currentRetryCount + 1,
          },
        });
      }
    } catch (error) {
      this.logger.error(
        `Error al incrementar retry count (${correlationId}):`,
        error,
      );
    }
  }
}
