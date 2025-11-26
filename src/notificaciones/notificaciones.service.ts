import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import {
  TipoNotificacion,
  EstadoNotificacion,
  TipoError,
} from '../../generated/prisma/enums';
import type { JuicioWithParticipants } from '../telegram/types';

@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger(NotificacionesService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => TelegramService))
    private telegramService: TelegramService,
    private auditoriaService: AuditoriaService,
  ) {}

  /**
   * Actualiza el estado de la notificación a ENTREGADO después de 1 minuto
   */
  private programarCambioAEntregado(notificacionId: string): void {
    setTimeout(() => {
      void (async () => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          await (this.prisma as any).notificacion.update({
            where: { id: notificacionId },
            data: {
              estado: EstadoNotificacion.ENTREGADO,
              fechaEntrega: new Date(),
            },
          });
          this.logger.log(
            `Notificación ${notificacionId} marcada como ENTREGADA después de 1 minuto`,
          );
        } catch (error) {
          this.logger.error(
            `Error al actualizar estado a ENTREGADO para notificación ${notificacionId}:`,
            error,
          );
        }
      })();
    }, 60000); // 1 minuto = 60000ms
  }

  async notificarCreacionJuicio(juicioId: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const juicio = (await (this.prisma as any).juicio.findUnique({
      where: { id: juicioId },
      include: {
        participantes: {
          include: {
            participante: true,
          },
        },
      },
    })) as JuicioWithParticipants | null;

    if (!juicio) {
      this.logger.error(`Juicio ${juicioId} no encontrado`);
      return;
    }

    // Calcular tiempo restante hasta el juicio
    const fechaJuicio = new Date(juicio.fecha);
    const ahora = new Date();
    const tiempoRestanteMs = fechaJuicio.getTime() - ahora.getTime();
    const tiempoRestanteHoras = tiempoRestanteMs / (1000 * 60 * 60);

    // Si quedan menos de 1 hora, notificar inmediatamente
    // Si quedan más de 1 hora, también notificar (notificación inicial de creación)
    const mensaje = this.telegramService.formatJuicioMessage(juicio);
    const chatIds = (juicio.participantes || [])
      .map((jp) => jp.participante.telegramChatId)
      .filter((id): id is string => id !== null && id !== undefined);

    if (chatIds.length === 0) {
      this.logger.warn(
        `No hay participantes con telegramChatId para el juicio ${juicioId}`,
      );
      return;
    }

    // Si quedan menos de 1 hora, agregar advertencia urgente al mensaje
    let mensajeFinal = mensaje;
    if (tiempoRestanteHoras < 1 && tiempoRestanteHoras > 0) {
      const minutosRestantes = Math.floor(tiempoRestanteMs / (1000 * 60));
      mensajeFinal = `⚠️ <b>URGENTE:</b> Este juicio es en ${minutosRestantes} minuto(s)\n\n${mensaje}`;
      this.logger.warn(
        `Juicio ${juicioId} creado con menos de 1 hora de anticipación (${minutosRestantes} minutos restantes)`,
      );
    }

    // Crear notificaciones primero para obtener sus IDs
    const notificacionesCreadas: Array<{
      id: string;
      participanteId: string;
      chatId: string;
    }> = [];

    for (const jp of juicio.participantes || []) {
      if (jp.participante.telegramChatId) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const notificacion = await (this.prisma as any).notificacion.create({
          data: {
            juicioId: juicio.id,
            participanteId: jp.participante.id,
            tipo: TipoNotificacion.CREACION,
            mensaje: mensajeFinal,
            enviada: false,
            estado: EstadoNotificacion.ENVIADO,
            fechaEnvio: new Date(),
          },
        });
        const notifId = (notificacion as { id: string }).id;
        notificacionesCreadas.push({
          id: notifId,
          participanteId: jp.participante.id,
          chatId: jp.participante.telegramChatId,
        });
      }
    }

    // Enviar mensajes individualmente con su propio botón de confirmación
    let successCount = 0;
    let failedCount = 0;

    for (const notificacion of notificacionesCreadas) {
      const keyboard = this.telegramService.getConfirmacionLecturaKeyboard(
        notificacion.id,
      );

      const result = await this.telegramService.sendMessage(
        notificacion.chatId,
        mensajeFinal,
        keyboard,
      );

      if (result.success && result.messageId) {
        // Actualizar como enviada pero mantener estado ENVIADO
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        await (this.prisma as any).notificacion.update({
          where: { id: notificacion.id },
          data: {
            enviada: true,
            estado: EstadoNotificacion.ENVIADO, // Mantener ENVIADO
            messageId: result.messageId.toString(),
            fechaEnvio: new Date(),
          },
        });

        // Programar cambio a ENTREGADO después de 1 minuto
        this.programarCambioAEntregado(notificacion.id);

        successCount++;
      } else {
        // Registrar error en auditoría
        await this.auditoriaService.registrarError({
          tipoError: TipoError.NOTIFICACION_API_ERROR,
          entidad: 'Notificacion',
          entidadId: notificacion.id,
          mensaje: `Error al enviar notificación a participante ${notificacion.participanteId}`,
          detalles: {
            chatId: notificacion.chatId,
            juicioId: juicio.id,
          },
        });
        failedCount++;
      }
    }

    this.logger.log(
      `Notificaciones enviadas: ${successCount} exitosas, ${failedCount} fallidas`,
    );

    // Si quedan más de 1 hora, programar recordatorio para 1 hora antes
    if (tiempoRestanteHoras > 1) {
      // Calcular cuándo enviar el recordatorio (1 hora antes)
      const tiempoParaRecordatorio = tiempoRestanteHoras - 1;
      this.logger.log(
        `Recordatorio programado para ${tiempoParaRecordatorio.toFixed(2)} horas (1 hora antes del juicio)`,
      );
      // Nota: En producción, esto debería usar un scheduler (cron job o similar)
      // Por ahora solo logueamos que debería enviarse
    }
  }

  async notificarActualizacionJuicio(juicioId: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const juicio = (await (this.prisma as any).juicio.findUnique({
      where: { id: juicioId },
      include: {
        participantes: {
          include: {
            participante: true,
          },
        },
      },
    })) as JuicioWithParticipants | null;

    if (!juicio) {
      this.logger.error(`Juicio ${juicioId} no encontrado`);
      return;
    }

    const mensaje = `📝 <b>Actualización de Juicio</b>\n\n${this.telegramService.formatJuicioMessage(juicio)}`;
    const chatIds = (juicio.participantes || [])
      .map((jp) => jp.participante.telegramChatId)
      .filter((id): id is string => id !== null && id !== undefined);

    if (chatIds.length === 0) {
      this.logger.warn(
        `No hay participantes con telegramChatId para el juicio ${juicioId}`,
      );
      return;
    }

    // Crear notificaciones primero
    const notificacionesCreadas: Array<{
      id: string;
      participanteId: string;
      chatId: string;
    }> = [];

    for (const jp of juicio.participantes || []) {
      if (jp.participante.telegramChatId) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const notificacion = await (this.prisma as any).notificacion.create({
          data: {
            juicioId: juicio.id,
            participanteId: jp.participante.id,
            tipo: TipoNotificacion.ACTUALIZACION,
            mensaje: mensaje,
            enviada: false,
            estado: EstadoNotificacion.ENVIADO,
            fechaEnvio: new Date(),
          },
        });
        const notifId = (notificacion as { id: string }).id;
        notificacionesCreadas.push({
          id: notifId,
          participanteId: jp.participante.id,
          chatId: jp.participante.telegramChatId,
        });
      }
    }

    // Enviar mensajes individualmente con su propio botón de confirmación
    let successCount = 0;
    let failedCount = 0;

    for (const notificacion of notificacionesCreadas) {
      const keyboard = this.telegramService.getConfirmacionLecturaKeyboard(
        notificacion.id,
      );

      const result = await this.telegramService.sendMessage(
        notificacion.chatId,
        mensaje,
        keyboard,
      );

      if (result.success && result.messageId) {
        // Actualizar como enviada pero mantener estado ENVIADO
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        await (this.prisma as any).notificacion.update({
          where: { id: notificacion.id },
          data: {
            enviada: true,
            estado: EstadoNotificacion.ENVIADO, // Mantener ENVIADO
            messageId: result.messageId.toString(),
            fechaEnvio: new Date(),
          },
        });

        // Programar cambio a ENTREGADO después de 1 minuto
        this.programarCambioAEntregado(notificacion.id);

        successCount++;
      } else {
        await this.auditoriaService.registrarError({
          tipoError: TipoError.NOTIFICACION_API_ERROR,
          entidad: 'Notificacion',
          entidadId: notificacion.id,
          mensaje: `Error al enviar notificación de actualización a participante ${notificacion.participanteId}`,
          detalles: {
            chatId: notificacion.chatId,
            juicioId: juicio.id,
          },
        });
        failedCount++;
      }
    }

    this.logger.log(
      `Notificaciones de actualización enviadas: ${successCount} exitosas, ${failedCount} fallidas`,
    );
  }

  async enviarRecordatorio(juicioId: string, horasAntes: number) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const juicio = (await (this.prisma as any).juicio.findUnique({
      where: { id: juicioId },
      include: {
        participantes: {
          include: {
            participante: true,
          },
        },
      },
    })) as JuicioWithParticipants | null;

    if (!juicio) {
      this.logger.error(`Juicio ${juicioId} no encontrado`);
      return;
    }

    const mensaje = this.telegramService.formatRecordatorioMessage(
      juicio,
      horasAntes,
    );
    const chatIds = (juicio.participantes || [])
      .map((jp) => jp.participante.telegramChatId)
      .filter((id): id is string => id !== null && id !== undefined);

    if (chatIds.length === 0) {
      this.logger.warn(
        `No hay participantes con telegramChatId para el juicio ${juicioId}`,
      );
      return;
    }

    const tipoNotificacion =
      horasAntes === 24
        ? TipoNotificacion.RECORDATORIO_24H
        : TipoNotificacion.RECORDATORIO_1H;

    // Crear notificaciones primero
    const notificacionesCreadas: Array<{
      id: string;
      participanteId: string;
      chatId: string;
    }> = [];

    for (const jp of juicio.participantes || []) {
      if (jp.participante.telegramChatId) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const notificacion = await (this.prisma as any).notificacion.create({
          data: {
            juicioId: juicio.id,
            participanteId: jp.participante.id,
            tipo: tipoNotificacion,
            mensaje: mensaje,
            enviada: false,
            estado: EstadoNotificacion.ENVIADO,
            fechaEnvio: new Date(),
          },
        });
        const notifId = (notificacion as { id: string }).id;
        notificacionesCreadas.push({
          id: notifId,
          participanteId: jp.participante.id,
          chatId: jp.participante.telegramChatId,
        });
      }
    }

    // Enviar mensajes individualmente con su propio botón de confirmación
    let successCount = 0;
    let failedCount = 0;

    for (const notificacion of notificacionesCreadas) {
      const keyboard = this.telegramService.getConfirmacionLecturaKeyboard(
        notificacion.id,
      );

      const result = await this.telegramService.sendMessage(
        notificacion.chatId,
        mensaje,
        keyboard,
      );

      if (result.success && result.messageId) {
        // Actualizar como enviada pero mantener estado ENVIADO
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        await (this.prisma as any).notificacion.update({
          where: { id: notificacion.id },
          data: {
            enviada: true,
            estado: EstadoNotificacion.ENVIADO, // Mantener ENVIADO
            messageId: result.messageId.toString(),
            fechaEnvio: new Date(),
          },
        });

        // Programar cambio a ENTREGADO después de 1 minuto
        this.programarCambioAEntregado(notificacion.id);

        successCount++;
      } else {
        await this.auditoriaService.registrarError({
          tipoError: TipoError.NOTIFICACION_API_ERROR,
          entidad: 'Notificacion',
          entidadId: notificacion.id,
          mensaje: `Error al enviar recordatorio a participante ${notificacion.participanteId}`,
          detalles: {
            chatId: notificacion.chatId,
            juicioId: juicio.id,
            horasAntes,
          },
        });
        failedCount++;
      }
    }

    this.logger.log(
      `Recordatorios enviados (${horasAntes}h antes): ${successCount} exitosas, ${failedCount} fallidas`,
    );
  }

  async marcarComoLeido(
    notificacionId: string,
  ): Promise<{ chatId: string | null }> {
    try {
      // Obtener la notificación con el participante para obtener el chatId
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const notificacion = await (this.prisma as any).notificacion.findUnique({
        where: { id: notificacionId },
        include: {
          participante: {
            select: {
              telegramChatId: true,
            },
          },
        },
      });

      if (!notificacion) {
        throw new Error(`Notificación ${notificacionId} no encontrada`);
      }

      // Actualizar el estado a LEIDO
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await (this.prisma as any).notificacion.update({
        where: { id: notificacionId },
        data: {
          estado: EstadoNotificacion.LEIDO,
          fechaLectura: new Date(),
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const participante = notificacion.participante as {
        telegramChatId: string | null;
      } | null;
      const chatId = participante?.telegramChatId || null;
      this.logger.log(`Notificación ${notificacionId} marcada como leída`);

      return { chatId };
    } catch (error) {
      this.logger.error(
        `Error al marcar notificación ${notificacionId} como leída:`,
        error,
      );
      throw error;
    }
  }
}
