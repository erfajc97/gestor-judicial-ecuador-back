import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getRoot() {
    return {
      message: 'API del Sistema de Agendamiento Judicial',
      version: '1.0.0',
      endpoints: {
        participantes: {
          list: 'GET /participantes',
          create: 'POST /participantes',
          get: 'GET /participantes/:id',
          update: 'PUT /participantes/:id',
          delete: 'DELETE /participantes/:id',
        },
        juicios: {
          list: 'GET /juicios',
          create: 'POST /juicios',
          get: 'GET /juicios/:id',
          update: 'PUT /juicios/:id',
          delete: 'DELETE /juicios/:id',
          addParticipant: 'POST /juicios/:id/participantes',
          removeParticipant:
            'DELETE /juicios/:id/participantes/:participanteId',
        },
        telegram: {
          webhook: 'POST /telegram/webhook',
          setWebhook: 'GET /telegram/set-webhook?url=...',
          webhookInfo: 'GET /telegram/webhook-info',
          register: 'POST /telegram/register',
        },
      },
    };
  }
}
