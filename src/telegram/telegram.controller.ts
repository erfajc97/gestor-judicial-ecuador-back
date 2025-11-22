import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { ParticipantesService } from '../participantes/participantes.service';
import { TipoParticipante } from '../../generated/prisma/enums';

class RegisterUserDto {
  chatId: string;
  userId?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    chat: {
      id: number;
      first_name?: string;
      last_name?: string;
      username?: string;
      type: 'private' | 'group' | 'supergroup' | 'channel';
    };
    date: number;
    text?: string;
  };
  callback_query?: {
    id: string;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    message?: {
      message_id: number;
      chat: {
        id: number;
      };
    };
    data: string;
  };
}

@Controller('telegram')
export class TelegramController {
  constructor(
    private readonly telegramService: TelegramService,
    private readonly participantesService: ParticipantesService,
  ) {}

  @Post('webhook')
  async handleWebhook(@Body() update: TelegramUpdate) {
    try {
      console.log('📥 Webhook recibido:', JSON.stringify(update, null, 2));

      // Procesar callback queries (botones inline)
      if (update.callback_query) {
        console.log(
          '🔄 Procesando callback_query:',
          update.callback_query.data,
        );
        const chatId = update.callback_query.from.id.toString();
        const callbackData = update.callback_query.data;
        const from = update.callback_query.from;

        // Procesar selección de tipo de participante
        if (callbackData.startsWith('tipo_')) {
          const tipoSeleccionado = callbackData.replace('tipo_', '') as
            | 'JUEZ'
            | 'ABOGADO_DEMANDANTE'
            | 'ABOGADO_DEFENSOR'
            | 'ACUSADO'
            | 'PERITO';

          // Buscar si ya existe un participante con este chat ID
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const participantes = await this.participantesService.findAll();
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          const participanteExistente = participantes.find(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            (p: any) => p.telegramChatId === chatId,
          );

          if (!participanteExistente) {
            // Crear un nuevo participante
            await this.participantesService.create({
              nombre: `${from.first_name} ${from.last_name || ''}`.trim(),
              tipo: tipoSeleccionado,
              telegramChatId: chatId,
            });

            // Responder al callback query (requerido por Telegram)
            await this.telegramService.answerCallbackQuery(
              update.callback_query.id,
              '✅ Registro exitoso',
            );

            // Enviar mensaje de confirmación
            await this.telegramService.sendMessage(
              chatId,
              `✅ <b>¡Registro exitoso!</b>\n\nTu Chat ID ha sido registrado: <code>${chatId}</code>\n\nTu tipo de participante: <b>${tipoSeleccionado}</b>\n\nUn administrador puede actualizar tu información completa (email, teléfono) en el sistema.\n\nAhora recibirás notificaciones sobre los juicios en los que participes.`,
            );
          } else {
            // Ya está registrado
            await this.telegramService.answerCallbackQuery(
              update.callback_query.id,
              '⚠️ Ya estás registrado',
            );

            const participante = participanteExistente as {
              tipo?: string;
              [key: string]: unknown;
            };
            const tipoActual = participante.tipo || 'No especificado';
            await this.telegramService.sendMessage(
              chatId,
              `✅ Ya estás registrado en el sistema.\n\nTu Chat ID: <code>${chatId}</code>\nTipo: <b>${tipoActual}</b>\n\nSi necesitas actualizar tu información, contacta al administrador.`,
            );
          }

          return { ok: true, message: 'Callback procesado' };
        }
      }

      // Procesar mensajes del bot
      if (update.message && update.message.text) {
        const chatId = update.message.chat.id.toString();
        const text = update.message.text.trim();
        const from = update.message.from;

        console.log(
          `💬 Mensaje recibido de ${from.first_name} (${chatId}): ${text}`,
        );

        // Si el usuario envía /start, registrar su chat ID
        if (text === '/start' || text.startsWith('/start')) {
          console.log('🚀 Procesando comando /start');
          // Buscar si ya existe un participante con este chat ID
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const participantes = await this.participantesService.findAll();
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          const participanteExistente = participantes.find(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            (p: any) => p.telegramChatId === chatId,
          );

          if (!participanteExistente) {
            // Intentar detectar el tipo de participante desde el comando /start
            // Formato: /start TIPO (ej: /start JUEZ, /start ACUSADO)
            const partes = text.split(' ');

            // Si solo se envía /start sin tipo, mostrar instrucciones con botones
            if (partes.length === 1 || partes[1].trim() === '') {
              console.log('📤 Enviando mensaje de bienvenida con botones');
              const mensajeEnviado = await this.telegramService.sendMessage(
                chatId,
                `👋 <b>¡Bienvenido!</b>\n\nPara registrarte en el sistema, selecciona tu tipo de participante usando los botones de abajo:`,
                this.telegramService.getTipoParticipanteKeyboard(),
              );
              console.log('✅ Mensaje enviado:', mensajeEnviado);
              return { ok: true, message: 'Instrucciones enviadas' };
            }

            // Validar el tipo ingresado
            const tipoIngresado = partes[1].toUpperCase().trim();
            const tiposValidos: Array<
              | 'JUEZ'
              | 'ABOGADO_DEMANDANTE'
              | 'ABOGADO_DEFENSOR'
              | 'ACUSADO'
              | 'PERITO'
            > = [
              'JUEZ',
              'ABOGADO_DEMANDANTE',
              'ABOGADO_DEFENSOR',
              'ACUSADO',
              'PERITO',
            ];

            if (
              !tiposValidos.includes(
                tipoIngresado as
                  | 'JUEZ'
                  | 'ABOGADO_DEMANDANTE'
                  | 'ABOGADO_DEFENSOR'
                  | 'ACUSADO'
                  | 'PERITO',
              )
            ) {
              await this.telegramService.sendMessage(
                chatId,
                `❌ <b>Tipo inválido</b>\n\nEl tipo "<code>${tipoIngresado}</code>" no es válido.\n\n<b>Tipos válidos:</b>\n• JUEZ\n• ABOGADO_DEMANDANTE\n• ABOGADO_DEFENSOR\n• ACUSADO\n• PERITO\n\n<b>Ejemplo:</b>\n/start JUEZ`,
              );
              return { ok: true, message: 'Tipo inválido' };
            }

            const tipoParticipante: TipoParticipante =
              tipoIngresado as TipoParticipante;

            // Crear un nuevo participante
            await this.participantesService.create({
              nombre: `${from.first_name} ${from.last_name || ''}`.trim(),
              tipo: tipoParticipante,
              telegramChatId: chatId,
            });

            // Enviar mensaje de confirmación
            await this.telegramService.sendMessage(
              chatId,
              `✅ <b>¡Registro exitoso!</b>\n\nTu Chat ID ha sido registrado: <code>${chatId}</code>\n\nTu tipo de participante: <b>${tipoParticipante}</b>\n\nUn administrador puede actualizar tu información completa (email, teléfono) en el sistema.\n\nAhora recibirás notificaciones sobre los juicios en los que participes.`,
            );
          } else {
            // Ya está registrado
            const participante = participanteExistente as {
              tipo?: string;
              [key: string]: unknown;
            };
            const tipoActual = participante.tipo || 'No especificado';
            await this.telegramService.sendMessage(
              chatId,
              `✅ Ya estás registrado en el sistema.\n\nTu Chat ID: <code>${chatId}</code>\nTipo: <b>${tipoActual}</b>\n\nSi necesitas actualizar tu información, contacta al administrador.`,
            );
          }

          return { ok: true, message: 'Usuario registrado' };
        }

        // Comando /help
        if (text === '/help') {
          await this.telegramService.sendMessage(
            chatId,
            `📋 <b>Comandos disponibles:</b>\n\n/start - Registrarse en el sistema\n/start TIPO - Registrarse especificando tu tipo\n   Tipos válidos: JUEZ, ABOGADO_DEMANDANTE, ABOGADO_DEFENSOR, ACUSADO, PERITO\n/help - Mostrar esta ayuda\n\n<b>Ejemplo:</b>\n/start JUEZ\n/start ABOGADO_DEMANDANTE\n\nPara más información, contacta al administrador del sistema.`,
          );
          return { ok: true };
        }
      }

      console.log('✅ Webhook procesado correctamente');
      return { ok: true };
    } catch (error) {
      console.error('❌ Error procesando webhook:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      return { ok: false, error: 'Error procesando webhook' };
    }
  }

  @Get('set-webhook')
  async setWebhook(@Query('url') url: string) {
    return this.telegramService.setWebhook(url);
  }

  @Get('webhook-info')
  async getWebhookInfo() {
    return this.telegramService.getWebhookInfo();
  }

  @Post('register')
  register(@Body() registerDto: RegisterUserDto) {
    // Este endpoint puede ser usado para registrar usuarios manualmente
    return {
      message: 'Usuario registrado',
      chatId: registerDto.chatId,
    };
  }
}
