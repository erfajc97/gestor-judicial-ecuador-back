import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
    private configService: ConfigService,
  ) {}

  /**
   * Valida la configuración requerida para ejecutar un experimento
   */
  validateExperimentConfig(
    experiment: ExperimentRun,
    dryRun: boolean = false,
  ): void {
    // En modo dryRun no se necesita validar configuración real
    if (dryRun) {
      this.logger.log(
        `Modo dryRun activado, omitiendo validación de configuración para experimento ${experiment.id}`,
      );
      return;
    }

    const target = experiment.channelTarget;
    const needsEmail =
      target === NotificationChannel.EMAIL ||
      target === NotificationChannel.BOTH;
    const needsTelegram =
      target === NotificationChannel.TELEGRAM ||
      target === NotificationChannel.BOTH;

    const missing: string[] = [];

    if (needsEmail) {
      const experimentEmailTo = this.configService.get<string>(
        'EXPERIMENT_EMAIL_TO',
      );
      const smtpHost = this.configService.get<string>('SMTP_HOST');
      const isStubMode = this.emailService.isStubMode();

      if (!experimentEmailTo || experimentEmailTo.trim() === '') {
        missing.push('EXPERIMENT_EMAIL_TO');
      }
      if (!smtpHost || smtpHost.trim() === '') {
        missing.push('SMTP_HOST');
      }
      if (isStubMode) {
        this.logger.warn(
          `EmailService está en modo STUB. Los emails no se enviarán realmente.`,
        );
      }
    }

    if (needsTelegram) {
      const experimentChatId = this.configService.get<string>(
        'EXPERIMENT_TELEGRAM_CHAT_ID',
      );
      const telegramToken =
        this.configService.get<string>('TELEGRAM_BOT_TOKEN');

      if (!experimentChatId || experimentChatId.trim() === '') {
        missing.push('EXPERIMENT_TELEGRAM_CHAT_ID');
      }
      if (!telegramToken || telegramToken.trim() === '') {
        missing.push('TELEGRAM_BOT_TOKEN');
      }
    }

    if (missing.length > 0) {
      const errorMessage = `Configuración faltante para el experimento (${target}): ${missing.join(', ')}. Por favor configure estas variables de entorno antes de ejecutar el experimento.`;
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    this.logger.log(
      `Configuración validada correctamente para experimento ${experiment.id} (${target})`,
    );
  }

  /**
   * Ejecuta un experimento completo
   */
  async runExperiment(
    experiment: ExperimentRun,
    dryRun: boolean,
  ): Promise<void> {
    const startTime = Date.now();
    const EXPERIMENT_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutos máximo

    // Variables de contadores (necesarias en catch también)
    let sentCount = 0;
    let successCount = 0;
    let failCount = 0;
    const latencies: number[] = [];

    try {
      // Validar configuración al inicio (solo si no es dryRun)
      if (!dryRun) {
        this.validateExperimentConfig(experiment, dryRun);
      }

      const limit = pLimit(experiment.concurrency);
      const ratePerSec = experiment.ratePerSec || 10;
      const delayBetweenBatches = 1000 / ratePerSec; // ms entre mensajes

      this.logger.log(
        `Iniciando experimento ${experiment.id}: ${experiment.totalMessages} mensajes, concurrencia ${experiment.concurrency}, rate ${ratePerSec}/s, dryRun=${dryRun}`,
      );

      // Configurar timeout para evitar que el experimento se cuelgue
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(
              `Experimento ${experiment.id} excedió el tiempo límite de ${EXPERIMENT_TIMEOUT_MS / 1000 / 60} minutos`,
            ),
          );
        }, EXPERIMENT_TIMEOUT_MS);
      });

      const tasks: Array<Promise<void>> = [];
      let lastSeriesUpdate = Date.now();
      const seriesInterval = 1000; // 1 segundo

      // Función auxiliar para enviar email
      const sendEmailMessage = async (
        index: number,
        correlationId: string,
        sentAt: Date,
      ): Promise<{
        success: boolean;
        messageId?: string;
        latencyMs?: number;
      }> => {
        const experimentEmailTo = this.configService.get<string>(
          'EXPERIMENT_EMAIL_TO',
        );

        if (!experimentEmailTo || experimentEmailTo.trim() === '') {
          const errorMsg =
            'EXPERIMENT_EMAIL_TO no está configurado. No se puede enviar email real sin una dirección de destino válida.';
          this.logger.error(
            `Error en mensaje ${index} del experimento ${experiment.id}: ${errorMsg}`,
          );
          await this.metricsRecorder.updateToFailed(
            correlationId,
            'EMAIL_CONFIG_ERROR',
            errorMsg,
          );
          return { success: false };
        }

        // Verificar que el servicio de email no esté en modo stub
        if (this.emailService.isStubMode()) {
          const errorMsg =
            'EmailService está en modo STUB. Los emails no se enviarán realmente. Configure SMTP correctamente.';
          this.logger.warn(
            `Advertencia en mensaje ${index} del experimento ${experiment.id}: ${errorMsg}`,
          );
        }

        this.logger.debug(
          `Enviando email ${index + 1}/${experiment.totalMessages} del experimento ${experiment.id} a ${experimentEmailTo}`,
        );

        const emailResult = await this.emailService.sendEmail({
          to: experimentEmailTo,
          subject: `Test ${experiment.name} - Mensaje ${index + 1}`,
          html: `<p>Este es un mensaje de prueba del experimento "${experiment.name}".<br/>Mensaje #${index + 1} de ${experiment.totalMessages}</p>`,
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
          this.logger.debug(
            `Email ${index + 1} enviado exitosamente (latency: ${latencyMs}ms)`,
          );
          return {
            success: true,
            messageId: emailResult.messageId,
            latencyMs,
          };
        } else {
          const errorMsg = emailResult.errorMessage || 'Unknown error';
          this.logger.warn(
            `Email ${index + 1} falló: ${emailResult.errorCode || 'EMAIL_ERROR'} - ${errorMsg}`,
          );
          await this.metricsRecorder.updateToFailed(
            correlationId,
            emailResult.errorCode || 'EMAIL_ERROR',
            errorMsg,
          );
          return { success: false };
        }
      };

      // Función auxiliar para enviar telegram
      const sendTelegramMessage = async (
        index: number,
        correlationId: string,
        sentAt: Date,
      ): Promise<{
        success: boolean;
        messageId?: string;
        latencyMs?: number;
      }> => {
        const experimentChatId = this.configService.get<string>(
          'EXPERIMENT_TELEGRAM_CHAT_ID',
        );

        if (!experimentChatId || experimentChatId.trim() === '') {
          const errorMsg =
            'EXPERIMENT_TELEGRAM_CHAT_ID no está configurado. No se puede enviar mensaje real sin un chat ID válido.';
          this.logger.error(
            `Error en mensaje ${index} del experimento ${experiment.id}: ${errorMsg}`,
          );
          await this.metricsRecorder.updateToFailed(
            correlationId,
            'TELEGRAM_CONFIG_ERROR',
            errorMsg,
          );
          return { success: false };
        }

        this.logger.debug(
          `Enviando mensaje Telegram ${index + 1}/${experiment.totalMessages} del experimento ${experiment.id} a chat ${experimentChatId}`,
        );

        const message = `🧪 <b>Test ${experiment.name}</b>\n\nEste es un mensaje de prueba del experimento.\nMensaje #${index + 1} de ${experiment.totalMessages}`;

        const telegramResult = await this.telegramService.sendMessage(
          experimentChatId,
          message,
        );

        if (telegramResult.success && telegramResult.messageId) {
          const providerAckAt = new Date();
          const latencyMs = providerAckAt.getTime() - sentAt.getTime();
          await this.metricsRecorder.updateToAcked({
            correlationId,
            status: MetricStatus.ACKED,
            providerAckAt,
            latencyMs,
          });
          this.logger.debug(
            `Mensaje Telegram ${index + 1} enviado exitosamente (latency: ${latencyMs}ms, messageId: ${telegramResult.messageId})`,
          );
          return {
            success: true,
            messageId: String(telegramResult.messageId),
            latencyMs,
          };
        } else {
          const errorMsg = 'Error al enviar mensaje a Telegram';
          this.logger.warn(`Mensaje Telegram ${index + 1} falló: ${errorMsg}`);
          await this.metricsRecorder.updateToFailed(
            correlationId,
            'TELEGRAM_SEND_ERROR',
            errorMsg,
          );
          return { success: false };
        }
      };

      // Función para enviar un mensaje
      const sendMessage = async (index: number): Promise<void> => {
        try {
          const recipientHash = this.hashRecipient(
            `test-${experiment.id}-${index}`,
          );
          const template = `experiment-${experiment.scenario}`;
          const sentAt = new Date();

          // Si es BOTH, enviar a ambos canales en paralelo
          if (experiment.channelTarget === NotificationChannel.BOTH) {
            // Crear dos correlationIds, uno por canal
            const emailCorrelationId =
              await this.metricsRecorder.recordPendingEvent({
                channel: NotificationChannel.EMAIL,
                template,
                recipientHash: `${recipientHash}-email`,
                experimentRunId: experiment.id,
              });

            const telegramCorrelationId =
              await this.metricsRecorder.recordPendingEvent({
                channel: NotificationChannel.TELEGRAM,
                template,
                recipientHash: `${recipientHash}-telegram`,
                experimentRunId: experiment.id,
              });

            if (dryRun) {
              // Simular ambos envíos en paralelo
              const [emailResult, telegramResult] = await Promise.all([
                (async () => {
                  // Email: peor rendimiento (latencia más alta, menos éxito)
                  const latencyMs = 150 + Math.random() * 150; // 150-300ms
                  const success = Math.random() > 0.08; // 92% éxito
                  await new Promise((resolve) =>
                    setTimeout(resolve, latencyMs * 1.2),
                  );

                  if (success) {
                    await this.metricsRecorder.updateToAcked({
                      correlationId: emailCorrelationId,
                      status: MetricStatus.ACKED,
                      providerAckAt: new Date(),
                      latencyMs,
                    });
                    return {
                      success: true,
                      messageId: `email-dry-${index}`,
                      latencyMs,
                    };
                  } else {
                    await this.metricsRecorder.updateToFailed(
                      emailCorrelationId,
                      'DRY_RUN_ERROR',
                      'Simulated error',
                    );
                    return { success: false };
                  }
                })(),
                (async () => {
                  // Telegram: mejor rendimiento (latencia mucho más baja, más éxito)
                  const latencyMs = 20 + Math.random() * 40; // 20-60ms
                  const success = Math.random() > 0.02; // 98% éxito
                  await new Promise((resolve) =>
                    setTimeout(resolve, latencyMs * 0.8),
                  );

                  if (success) {
                    await this.metricsRecorder.updateToAcked({
                      correlationId: telegramCorrelationId,
                      status: MetricStatus.ACKED,
                      providerAckAt: new Date(),
                      latencyMs,
                    });
                    return {
                      success: true,
                      messageId: `telegram-dry-${index}`,
                      latencyMs,
                    };
                  } else {
                    await this.metricsRecorder.updateToFailed(
                      telegramCorrelationId,
                      'DRY_RUN_ERROR',
                      'Simulated error',
                    );
                    return { success: false };
                  }
                })(),
              ]);

              // Actualizar contadores (cada mensaje BOTH = 2 envíos)
              sentCount += 2;
              if (emailResult.success) {
                successCount++;
                if (emailResult.latencyMs) {
                  latencies.push(emailResult.latencyMs);
                }
              } else {
                failCount++;
              }
              if (telegramResult.success) {
                successCount++;
                if (telegramResult.latencyMs) {
                  latencies.push(telegramResult.latencyMs);
                }
              } else {
                failCount++;
              }
            } else {
              // Enviar a ambos canales en paralelo (real)
              const [emailResult, telegramResult] = await Promise.all([
                sendEmailMessage(index, emailCorrelationId, sentAt),
                sendTelegramMessage(index, telegramCorrelationId, sentAt),
              ]);

              // Actualizar contadores (cada mensaje BOTH = 2 envíos)
              sentCount += 2;
              if (emailResult.success) {
                successCount++;
                if (emailResult.latencyMs) {
                  latencies.push(emailResult.latencyMs);
                }
              } else {
                failCount++;
              }
              if (telegramResult.success) {
                successCount++;
                if (telegramResult.latencyMs) {
                  latencies.push(telegramResult.latencyMs);
                }
              } else {
                failCount++;
              }
            }
          } else {
            // Lógica para EMAIL o TELEGRAM individual
            const channel = this.getChannelForTarget(
              experiment.channelTarget,
              index,
            );
            const correlationId = await this.metricsRecorder.recordPendingEvent(
              {
                channel,
                template,
                recipientHash,
                experimentRunId: experiment.id,
              },
            );

            let result: {
              success: boolean;
              messageId?: string;
              latencyMs?: number;
            };

            if (dryRun) {
              // Modo dry-run: simular envío con métricas diferenciadas
              const isTelegram = channel === NotificationChannel.TELEGRAM;

              if (isTelegram) {
                // Telegram: mejor rendimiento (latencia mucho más baja por uso de sockets, más éxito)
                const latencyMs = 20 + Math.random() * 40; // 20-60ms (mucho más rápido que Email por sockets)
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

              // Actualizar contadores (solo para canales individuales)
              sentCount++;
              if (result.success) {
                successCount++;
                if (result.latencyMs) {
                  latencies.push(result.latencyMs);
                }
              } else {
                failCount++;
              }
            } else {
              // Envío real - usar el canal determinado por getChannelForTarget
              if (channel === NotificationChannel.EMAIL) {
                result = await sendEmailMessage(index, correlationId, sentAt);
              } else if (channel === NotificationChannel.TELEGRAM) {
                result = await sendTelegramMessage(
                  index,
                  correlationId,
                  sentAt,
                );
              } else {
                // Canal no reconocido
                await this.metricsRecorder.updateToFailed(
                  correlationId,
                  'UNKNOWN_CHANNEL',
                  `Canal desconocido: ${channel}`,
                );
                result = { success: false };
              }

              // Actualizar contadores (solo para canales individuales, BOTH ya actualiza arriba)
              sentCount++;
              if (result.success) {
                successCount++;
                if (result.latencyMs) {
                  latencies.push(result.latencyMs);
                }
              } else {
                failCount++;
              }
            }
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

      // Esperar a que todas las tareas terminen o timeout
      await Promise.race([Promise.all(tasks), timeoutPromise]);

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
        `Experimento ${experiment.id} completado exitosamente: ${successCount}/${sentCount} exitosos, ${failCount} fallidos, p95=${p95}ms, duración=${durationSec.toFixed(2)}s`,
      );
    } catch (error) {
      // Asegurar que siempre se actualice el estado del experimento
      const errorMessage =
        error instanceof Error ? error.message : 'Error desconocido';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Error ejecutando experimento ${experiment.id}: ${errorMessage}`,
        errorStack,
      );

      // Actualizar experimento como FAILED
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        await (this.prisma as any).experimentRun.update({
          where: { id: experiment.id },
          data: {
            status: ExperimentStatus.FAILED,
            finishedAt: new Date(),
            summaryJson: {
              totalSent: sentCount,
              totalSuccess: successCount,
              totalFailed: failCount,
              error: errorMessage,
            },
          },
        });
        this.logger.log(
          `Experimento ${experiment.id} marcado como FAILED debido a error`,
        );
      } catch (updateError) {
        this.logger.error(
          `Error crítico: No se pudo actualizar el estado del experimento ${experiment.id} a FAILED:`,
          updateError,
        );
      }

      // Re-lanzar el error para que el caller pueda manejarlo si es necesario
      throw error;
    }
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
