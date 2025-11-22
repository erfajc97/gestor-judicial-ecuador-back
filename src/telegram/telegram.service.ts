import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type { JuicioWithParticipants } from './types';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly botToken: string;
  private readonly apiUrl: string;

  constructor(private configService: ConfigService) {
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
  ): Promise<boolean> {
    if (!this.botToken) {
      this.logger.warn('TELEGRAM_BOT_TOKEN no configurado');
      return false;
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

      return (response.data as { ok: boolean }).ok === true;
    } catch (error) {
      this.logger.error(`Error enviando mensaje a ${chatId}:`, error);
      return false;
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

  async sendMessageToGroup(groupId: string, message: string): Promise<boolean> {
    return this.sendMessage(groupId, message);
  }

  async sendMessageToMultipleUsers(
    chatIds: string[],
    message: string,
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const chatId of chatIds) {
      const result = await this.sendMessage(chatId, message);
      if (result) {
        success++;
      } else {
        failed++;
      }
    }

    return { success, failed };
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
