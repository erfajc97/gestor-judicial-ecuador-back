import type {
  Juicio,
  Participante,
  JuicioParticipante,
} from '../../generated/prisma/client';

export interface ParticipanteWithChatId extends Participante {
  telegramChatId: string | null;
}

export interface JuicioParticipanteWithParticipante extends JuicioParticipante {
  participante: ParticipanteWithChatId;
}

export interface JuicioWithParticipants extends Juicio {
  participantes?: JuicioParticipanteWithParticipante[];
}
