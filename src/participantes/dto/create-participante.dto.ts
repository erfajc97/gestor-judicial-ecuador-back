import { IsString, IsOptional, IsIn } from 'class-validator';
import { TipoParticipante } from '../../../generated/prisma/enums';

export class CreateParticipanteDto {
  @IsString()
  nombre: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsIn(Object.values(TipoParticipante))
  tipo: (typeof TipoParticipante)[keyof typeof TipoParticipante];

  @IsOptional()
  @IsString()
  telegramChatId?: string;
}
