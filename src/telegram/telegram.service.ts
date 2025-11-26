import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { TipoError } from '../../generated/prisma/enums';
import type { JuicioWithParticipants } from './types';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly botToken: string;
  private readonly apiUrl: string;

  constructor(
    private configService: ConfigService,
    private auditoriaService: AuditoriaService,
  ) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN') || '';
    this.apiUrl = `https://api.telegram.org/bot${this.botToken}`;
  }

  async sendMessage(
    chatId: string,
    message: string,
    keyboard?: {
      inline_keyboard?: Array<Array<{ text: string; callback_data: string }>>;
      keyboard?: Array<Array<{ text: string }>>;
      resize_keyboard?: boolean;
      one_time_keyboard?: boolean;
    },
  ): Promise<{ success: boolean; messageId?: number }> {
    if (!this.botToken) {
      this.logger.warn('TELEGRAM_BOT_TOKEN no configurado');
      return { success: false };
    }

    try {
      const payload: {
        chat_id: string;
        text: string;
        parse_mode: string;
        reply_markup?: {
          inline_keyboard?: Array<
            Array<{ text: string; callback_data: string }>
          >;
          keyboard?: Array<Array<{ text: string }>>;
          resize_keyboard?: boolean;
          one_time_keyboard?: boolean;
        };
      } = {
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      };

      if (keyboard) {
        payload.reply_markup = keyboard;
      }

      const response = await axios.post(`${this.apiUrl}/sendMessage`, payload);
      const responseData = response.data as {
        ok: boolean;
        result?: { message_id: number };
      };

      if (responseData.ok && responseData.result) {
        return {
          success: true,
          messageId: responseData.result.message_id,
        };
      }

      return { success: false };
    } catch (error) {
      this.logger.error(`Error enviando mensaje a ${chatId}:`, error);

      // Registrar error en auditoría
      if (axios.isAxiosError(error)) {
        const errorCode = error.response?.status;

        const errorData = error.response?.data as
          | { description?: string }
          | undefined;
        const errorDescription = errorData?.description || error.message;

        // Determinar tipo de error específico
        let tipoError: TipoError = TipoError.TELEGRAM_API_ERROR;
        if (errorCode === 400) {
          // Bad Request - puede ser chat_id inválido

          if (
            typeof errorDescription === 'string' &&
            (errorDescription.includes('chat not found') ||
              errorDescription.includes('chat_id'))
          ) {
            tipoError = TipoError.NOTIFICACION_TELEGRAM_ID_INVALIDO;
          }
        } else if (errorCode === 403) {
          // Forbidden - bot bloqueado
          tipoError = TipoError.NOTIFICACION_BOT_BLOQUEADO;
        }

        this.auditoriaService
          .registrarError({
            tipoError,
            entidad: 'Notificacion',
            mensaje: `Error de Telegram API al enviar mensaje a ${chatId}: ${errorDescription}`,
            detalles: {
              chatId,
              errorCode,
              errorDescription,
              url: `${this.apiUrl}/sendMessage`,
            },
            stackTrace: error.stack,
          })
          .catch((auditError) => {
            this.logger.error('Error al registrar en auditoría:', auditError);
          });
      } else {
        this.auditoriaService
          .registrarError({
            tipoError: TipoError.TELEGRAM_API_ERROR,
            entidad: 'Notificacion',
            mensaje: `Error desconocido al enviar mensaje a ${chatId}`,
            detalles: {
              chatId,
              error:
                error instanceof Error ? error.message : 'Error desconocido',
            },
            stackTrace: error instanceof Error ? error.stack : undefined,
          })
          .catch((auditError) => {
            this.logger.error('Error al registrar en auditoría:', auditError);
          });
      }

      return { success: false };
    }
  }

  /**
   * Crea un teclado inline para seleccionar el tipo de participante
   */
  getTipoParticipanteKeyboard(): {
    inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
  } {
    return {
      inline_keyboard: [
        [
          { text: '👨‍⚖️ Juez', callback_data: 'tipo_JUEZ' },
          {
            text: '⚖️ Abogado Demandante',
            callback_data: 'tipo_ABOGADO_DEMANDANTE',
          },
        ],
        [
          {
            text: '🛡️ Abogado Defensor',
            callback_data: 'tipo_ABOGADO_DEFENSOR',
          },
          { text: '👤 Acusado', callback_data: 'tipo_ACUSADO' },
        ],
        [{ text: '🔬 Perito', callback_data: 'tipo_PERITO' }],
      ],
    };
  }

  async sendMessageToGroup(
    groupId: string,
    message: string,
  ): Promise<{ success: boolean; messageId?: number }> {
    return this.sendMessage(groupId, message);
  }

  async sendMessageToMultipleUsers(
    chatIds: string[],
    message: string,
    keyboard?: {
      inline_keyboard?: Array<Array<{ text: string; callback_data: string }>>;
    },
  ): Promise<{
    success: number;
    failed: number;
    results: Array<{ chatId: string; success: boolean; messageId?: number }>;
  }> {
    let success = 0;
    let failed = 0;
    const results: Array<{
      chatId: string;
      success: boolean;
      messageId?: number;
    }> = [];

    for (const chatId of chatIds) {
      const result = await this.sendMessage(chatId, message, keyboard);
      if (result.success) {
        success++;
      } else {
        failed++;
      }
      results.push({
        chatId,
        success: result.success,
        messageId: result.messageId,
      });
    }

    return { success, failed, results };
  }

  /**
   * Crea un teclado inline con botón de confirmación de lectura
   */
  getConfirmacionLecturaKeyboard(notificacionId: string): {
    inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
  } {
    return {
      inline_keyboard: [
        [
          {
            text: '✅ Confirmar Lectura',
            callback_data: `confirmar_lectura_${notificacionId}`,
          },
        ],
      ],
    };
  }

  createGroup(groupName: string): Promise<string | null> {
    if (!this.botToken) {
      this.logger.warn('TELEGRAM_BOT_TOKEN no configurado');
      return Promise.resolve(null);
    }

    try {
      // Nota: La creación de grupos requiere que el bot sea agregado manualmente
      // Este método es para referencia, pero normalmente se crea el grupo manualmente
      // y luego se obtiene el chat_id
      this.logger.log(
        `Para crear un grupo: agregue el bot al grupo "${groupName}" y luego obtenga el chat_id`,
      );
      return Promise.resolve(null);
    } catch (error) {
      this.logger.error('Error creando grupo:', error);
      return Promise.resolve(null);
    }
  }

  formatJuicioMessage(juicio: JuicioWithParticipants): string {
    const fecha = new Date(juicio.fecha).toLocaleDateString('es-EC', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return `
<b>📋 Notificación de Juicio</b>

<b>Número de Caso:</b> ${juicio.numeroCaso}
<b>Tipo de Juicio:</b> ${juicio.tipoJuicio}
<b>Fecha:</b> ${fecha}
<b>Hora:</b> ${juicio.hora}
<b>Sala:</b> ${juicio.sala}
${juicio.descripcion ? `<b>Descripción:</b> ${juicio.descripcion}` : ''}
<b>Estado:</b> ${juicio.estado}

Por favor, confirme su asistencia.
    `.trim();
  }

  formatRecordatorioMessage(
    juicio: JuicioWithParticipants,
    horasAntes: number,
  ): string {
    const fecha = new Date(juicio.fecha).toLocaleDateString('es-EC', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return `
<b>⏰ Recordatorio de Juicio</b>

Le recordamos que tiene un juicio programado:

<b>Número de Caso:</b> ${juicio.numeroCaso}
<b>Fecha:</b> ${fecha}
<b>Hora:</b> ${juicio.hora}
<b>Sala:</b> ${juicio.sala}

Faltan ${horasAntes} hora(s) para el inicio del juicio.
    `.trim();
  }

  async answerCallbackQuery(
    callbackQueryId: string,
    text?: string,
  ): Promise<boolean> {
    if (!this.botToken) {
      this.logger.warn('TELEGRAM_BOT_TOKEN no configurado');
      return false;
    }

    try {
      const response = await axios.post(`${this.apiUrl}/answerCallbackQuery`, {
        callback_query_id: callbackQueryId,
        text: text,
        show_alert: false,
      });

      return (response.data as { ok: boolean }).ok === true;
    } catch (error) {
      this.logger.error('Error respondiendo callback query:', error);
      return false;
    }
  }

  async setWebhook(url: string): Promise<{ ok: boolean; message?: string }> {
    if (!this.botToken) {
      this.logger.warn('TELEGRAM_BOT_TOKEN no configurado');
      return { ok: false, message: 'Token no configurado' };
    }

    try {
      const response = await axios.post(`${this.apiUrl}/setWebhook`, {
        url: url,
      });

      const result = response.data as { ok: boolean; description?: string };
      if (result.ok) {
        this.logger.log(`Webhook configurado: ${url}`);
        return { ok: true, message: 'Webhook configurado correctamente' };
      } else {
        return {
          ok: false,
          message: result.description || 'Error configurando webhook',
        };
      }
    } catch (error) {
      this.logger.error('Error configurando webhook:', error);
      return { ok: false, message: 'Error configurando webhook' };
    }
  }

  async getWebhookInfo(): Promise<{
    ok: boolean;
    url?: string;
    pending_update_count?: number;
    last_error_date?: number;
    last_error_message?: string;
  }> {
    if (!this.botToken) {
      this.logger.warn('TELEGRAM_BOT_TOKEN no configurado');
      return { ok: false };
    }

    try {
      const response = await axios.get(`${this.apiUrl}/getWebhookInfo`);
      const result = response.data as {
        ok: boolean;
        result?: {
          url: string;
          pending_update_count: number;
          last_error_date?: number;
          last_error_message?: string;
        };
      };

      if (result.ok && result.result) {
        return {
          ok: true,
          url: result.result.url,
          pending_update_count: result.result.pending_update_count,
          last_error_date: result.result.last_error_date,
          last_error_message: result.result.last_error_message,
        };
      }

      return { ok: false };
    } catch (error) {
      this.logger.error('Error obteniendo información del webhook:', error);
      return { ok: false };
    }
  }
}
