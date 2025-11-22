import { IsString, IsOptional } from 'class-validator';

export class AddParticipanteDto {
  @IsString()
  participanteId: string;
  @IsOptional()
  @IsString()
  rol?: string;
}
