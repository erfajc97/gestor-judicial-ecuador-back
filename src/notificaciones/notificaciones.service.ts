import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { TipoNotificacion } from '../../generated/prisma/enums';
import type { JuicioWithParticipants } from '../telegram/types';

@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger(NotificacionesService.name);

  constructor(
    private prisma: PrismaService,
    private telegramService: TelegramService,
  ) {}

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

    const results = await this.telegramService.sendMessageToMultipleUsers(
      chatIds,
      mensajeFinal,
    );

    // Guardar notificaciones en la base de datos
    for (const jp of juicio.participantes || []) {
      if (jp.participante.telegramChatId) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        await (this.prisma as any).notificacion.create({
          data: {
            juicioId: juicio.id,
            participanteId: jp.participante.id,
            tipo: TipoNotificacion.CREACION,
            mensaje: mensajeFinal,
            enviada: true,
            fechaEnvio: new Date(),
          },
        });
      }
    }

    this.logger.log(
      `Notificaciones enviadas: ${results.success} exitosas, ${results.failed} fallidas`,
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

    const results = await this.telegramService.sendMessageToMultipleUsers(
      chatIds,
      mensaje,
    );

    // Guardar notificaciones
    for (const jp of juicio.participantes || []) {
      if (jp.participante.telegramChatId) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        await (this.prisma as any).notificacion.create({
          data: {
            juicioId: juicio.id,
            participanteId: jp.participante.id,
            tipo: TipoNotificacion.ACTUALIZACION,
            mensaje: mensaje,
            enviada: true,
            fechaEnvio: new Date(),
          },
        });
      }
    }

    this.logger.log(
      `Notificaciones de actualización enviadas: ${results.success} exitosas, ${results.failed} fallidas`,
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

    const results = await this.telegramService.sendMessageToMultipleUsers(
      chatIds,
      mensaje,
    );

    // Guardar notificaciones
    for (const jp of juicio.participantes || []) {
      if (jp.participante.telegramChatId) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        await (this.prisma as any).notificacion.create({
          data: {
            juicioId: juicio.id,
            participanteId: jp.participante.id,
            tipo: tipoNotificacion,
            mensaje: mensaje,
            enviada: true,
            fechaEnvio: new Date(),
          },
        });
      }
    }

    this.logger.log(
      `Recordatorios enviados (${horasAntes}h antes): ${results.success} exitosas, ${results.failed} fallidas`,
    );
  }
}
