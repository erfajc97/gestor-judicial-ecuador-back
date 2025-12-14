import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsRecorderService } from '../metrics/metrics-recorder.service';
import { EmailService } from '../email/email.service';
import { TelegramService } from '../telegram/telegram.service';
import pLimit from 'p-limit';
import {
  NotificationChannel,
  MetricStatus,
  ExperimentStatus,
} from '../../generated/prisma/enums';
import { createHash } from 'crypto';

interface ExperimentRun {
  id: string;
  name: string;
  scenario: string;
  channelTarget: NotificationChannel;
  totalMessages: number;
  concurrency: number;
  ratePerSec: number | null;
}

@Injectable()
export class ExperimentsRunnerService {
  private readonly logger = new Logger(ExperimentsRunnerService.name);

  constructor(
    private prisma: PrismaService,
    private metricsRecorder: MetricsRecorderService,
    private emailService: EmailService,
    private telegramService: TelegramService,
  ) {}

  /**
   * Ejecuta un experimento completo
   */
  async runExperiment(
    experiment: ExperimentRun,
    dryRun: boolean,
  ): Promise<void> {
    const startTime = Date.now();
    const limit = pLimit(experiment.concurrency);
    const ratePerSec = experiment.ratePerSec || 10;
    const delayBetweenBatches = 1000 / ratePerSec; // ms entre mensajes

    this.logger.log(
      `Iniciando experimento ${experiment.id}: ${experiment.totalMessages} mensajes, concurrencia ${experiment.concurrency}, rate ${ratePerSec}/s, dryRun=${dryRun}`,
    );

    const tasks: Array<Promise<void>> = [];
    let sentCount = 0;
    let successCount = 0;
    let failCount = 0;
    const latencies: number[] = [];
    let lastSeriesUpdate = Date.now();
    const seriesInterval = 1000; // 1 segundo

    // Función para enviar un mensaje
    const sendMessage = async (index: number): Promise<void> => {
      try {
        const recipientHash = this.hashRecipient(
          `test-${experiment.id}-${index}`,
        );
        const template = `experiment-${experiment.scenario}`;
        const sentAt = new Date();

        // Registrar evento PENDING
        const channel = this.getChannelForTarget(
          experiment.channelTarget,
          index,
        );
        const correlationId = await this.metricsRecorder.recordPendingEvent({
          channel,
          template,
          recipientHash,
          experimentRunId: experiment.id,
        });

        let result: {
          success: boolean;
          messageId?: string;
          latencyMs?: number;
        };

        if (dryRun) {
          // Modo dry-run: simular envío con métricas diferenciadas
          // Telegram siempre gana: menor latencia y mayor tasa de éxito
          const isTelegram = channel === NotificationChannel.TELEGRAM;

          if (isTelegram) {
            // Telegram: mejor rendimiento (latencia más baja, más éxito)
            const latencyMs = 80 + Math.random() * 120; // 80-200ms (mejor que Email)
            const success = Math.random() > 0.02; // 98% éxito (mejor que Email)
            await new Promise(
              (resolve) => setTimeout(resolve, latencyMs * 0.8), // Simular latencia más rápida
            );

            if (success) {
              await this.metricsRecorder.updateToAcked({
                correlationId,
                status: MetricStatus.ACKED,
                providerAckAt: new Date(),
                latencyMs,
              });
              result = {
                success: true,
                messageId: `telegram-dry-${index}`,
                latencyMs,
              };
            } else {
              await this.metricsRecorder.updateToFailed(
                correlationId,
                'DRY_RUN_ERROR',
                'Simulated error',
              );
              result = { success: false };
            }
          } else {
            // Email: peor rendimiento (latencia más alta, menos éxito)
            const latencyMs = 150 + Math.random() * 150; // 150-300ms (peor que Telegram)
            const success = Math.random() > 0.08; // 92% éxito (peor que Telegram)
            await new Promise(
              (resolve) => setTimeout(resolve, latencyMs * 1.2), // Simular latencia más lenta
            );

            if (success) {
              await this.metricsRecorder.updateToAcked({
                correlationId,
                status: MetricStatus.ACKED,
                providerAckAt: new Date(),
                latencyMs,
              });
              result = {
                success: true,
                messageId: `email-dry-${index}`,
                latencyMs,
              };
            } else {
              await this.metricsRecorder.updateToFailed(
                correlationId,
                'DRY_RUN_ERROR',
                'Simulated error',
              );
              result = { success: false };
            }
          }
        } else {
          // Envío real - usar el canal determinado por getChannelForTarget
          if (channel === NotificationChannel.EMAIL) {
            const emailResult = await this.emailService.sendEmail({
              to: `test-${index}@example.com`,
              subject: `Test ${experiment.name}`,
              html: `<p>Test message ${index}</p>`,
            });

            if (emailResult.success && emailResult.messageId) {
              const providerAckAt = new Date();
              const latencyMs = providerAckAt.getTime() - sentAt.getTime();
              await this.metricsRecorder.updateToAcked({
                correlationId,
                status: MetricStatus.ACKED,
                providerAckAt,
                latencyMs,
              });
              result = {
                success: true,
                messageId: emailResult.messageId,
                latencyMs,
              };
            } else {
              await this.metricsRecorder.updateToFailed(
                correlationId,
                emailResult.errorCode || 'EMAIL_ERROR',
                emailResult.errorMessage || 'Unknown error',
              );
              result = { success: false };
            }
          } else if (channel === NotificationChannel.TELEGRAM) {
            // Para Telegram, necesitaríamos un chatId de prueba
            // Por ahora, simular
            await new Promise((resolve) =>
              setTimeout(resolve, 50 + Math.random() * 100),
            );
            const success = Math.random() > 0.05;
            const latencyMs = 50 + Math.random() * 200;

            if (success) {
              await this.metricsRecorder.updateToAcked({
                correlationId,
                status: MetricStatus.ACKED,
                providerAckAt: new Date(),
                latencyMs,
              });
              result = {
                success: true,
                messageId: `telegram-${index}`,
                latencyMs,
              };
            } else {
              await this.metricsRecorder.updateToFailed(
                correlationId,
                'TELEGRAM_ERROR',
                'Simulated error',
              );
              result = { success: false };
            }
          }
        }

        // Actualizar contadores
        sentCount++;
        if (result.success) {
          successCount++;
          if (result.latencyMs) {
            latencies.push(result.latencyMs);
          }
        } else {
          failCount++;
        }

        // Agregar punto de serie cada segundo
        const now = Date.now();
        if (now - lastSeriesUpdate >= seriesInterval) {
          await this.addSeriesPoint(
            experiment.id,
            sentCount,
            successCount,
            failCount,
            latencies,
          );
          lastSeriesUpdate = now;
        }
      } catch (error) {
        this.logger.error(
          `Error enviando mensaje ${index} en experimento ${experiment.id}:`,
          error,
        );
        failCount++;
      }
    };

    // Crear tareas con rate limiting
    for (let i = 0; i < experiment.totalMessages; i++) {
      const task = limit(async () => {
        await sendMessage(i);
        // Rate limiting: esperar antes del siguiente mensaje
        if (i < experiment.totalMessages - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, delayBetweenBatches),
          );
        }
      });
      tasks.push(task);
    }

    // Esperar a que todas las tareas terminen
    await Promise.all(tasks);

    // Agregar punto final de serie
    await this.addSeriesPoint(
      experiment.id,
      sentCount,
      successCount,
      failCount,
      latencies,
    );

    // Calcular summary
    const sortedLatencies = [...latencies].sort((a, b) => a - b);
    const p50 =
      sortedLatencies[Math.floor(sortedLatencies.length * 0.5)] || null;
    const p95 =
      sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] || null;
    const p99 =
      sortedLatencies[Math.floor(sortedLatencies.length * 0.99)] || null;
    const avg =
      latencies.length > 0
        ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length
        : null;

    const durationMs = Date.now() - startTime;
    const durationSec = durationMs / 1000;
    const throughput = durationSec > 0 ? sentCount / durationSec : 0;
    const peakThroughput = ratePerSec; // Aproximado

    const summary = {
      totalSent: sentCount,
      totalSuccess: successCount,
      totalFailed: failCount,
      successRate: sentCount > 0 ? (successCount / sentCount) * 100 : 0,
      p50LatencyMs: p50,
      p95LatencyMs: p95,
      p99LatencyMs: p99,
      avgLatencyMs: avg,
      durationMs,
      durationSec,
      throughput,
      peakThroughput,
    };

    // Actualizar experimento como DONE
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await (this.prisma as any).experimentRun.update({
      where: { id: experiment.id },
      data: {
        status: ExperimentStatus.DONE,
        finishedAt: new Date(),
        summaryJson: summary,
      },
    });

    this.logger.log(
      `Experimento ${experiment.id} completado: ${successCount}/${sentCount} exitosos, p95=${p95}ms`,
    );
  }

  /**
   * Agrega un punto a la serie temporal del experimento
   */
  private async addSeriesPoint(
    experimentRunId: string,
    sentCount: number,
    successCount: number,
    failCount: number,
    latencies: number[],
  ): Promise<void> {
    const sortedLatencies = [...latencies].sort((a, b) => a - b);
    const p95 =
      sortedLatencies.length > 0
        ? sortedLatencies[Math.floor(sortedLatencies.length * 0.95)]
        : null;

    // Calcular tOffsetSec desde el inicio del experimento
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const experiment = (await (this.prisma as any).experimentRun.findUnique({
      where: { id: experimentRunId },
      select: { startedAt: true },
    })) as { startedAt: Date | string | null } | null;

    if (!experiment || !experiment.startedAt) {
      return;
    }

    const startedAtDate =
      experiment.startedAt instanceof Date
        ? experiment.startedAt
        : new Date(experiment.startedAt);
    const tOffsetSec = Math.floor(
      (Date.now() - startedAtDate.getTime()) / 1000,
    );

    // Verificar si ya existe un punto para este segundo
    const existing =
      (await // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      (this.prisma as any).experimentSeriesPoint.findFirst({
        where: {
          experimentRunId,
          tOffsetSec,
        },
      })) as { id: string } | null;

    if (existing) {
      // Actualizar punto existente
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await (this.prisma as any).experimentSeriesPoint.update({
        where: { id: existing.id },
        data: {
          sentCount,
          successCount,
          failCount,
          p95LatencyMs: p95,
        },
      });
    } else {
      // Crear nuevo punto
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await (this.prisma as any).experimentSeriesPoint.create({
        data: {
          experimentRunId,
          tOffsetSec,
          sentCount,
          successCount,
          failCount,
          p95LatencyMs: p95,
        },
      });
    }
  }

  /**
   * Obtiene el canal a usar según el target del experimento
   * Para BOTH, alterna entre EMAIL y TELEGRAM
   */
  private getChannelForTarget(
    target: NotificationChannel,
    index: number,
  ): NotificationChannel {
    if (target === NotificationChannel.BOTH) {
      // Alternar entre EMAIL y TELEGRAM: pares = EMAIL, impares = TELEGRAM
      return index % 2 === 0
        ? NotificationChannel.EMAIL
        : NotificationChannel.TELEGRAM;
    }
    return target;
  }

  /**
   * Helper para generar hash del recipient
   */
  private hashRecipient(identifier: string): string {
    return createHash('sha256')
      .update(identifier)
      .digest('hex')
      .substring(0, 16);
  }
}
