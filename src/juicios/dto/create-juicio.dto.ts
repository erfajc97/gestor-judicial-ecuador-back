import {
  IsString,
  IsDateString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EstadoJuicio } from '../../../generated/prisma/enums';

class ParticipanteDto {
  @IsString()
  participanteId: string;

  @IsOptional()
  @IsString()
  rol?: string;
}

export class CreateJuicioDto {
  @IsString()
  numeroCaso: string;

  @IsString()
  tipoJuicio: string;

  @IsDateString()
  fecha: string;

  @IsString()
  hora: string;

  @IsString()
  sala: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsIn(Object.values(EstadoJuicio))
  estado?: (typeof EstadoJuicio)[keyof typeof EstadoJuicio];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParticipanteDto)
  participantes?: ParticipanteDto[];
}
