import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateJuicioDto } from './create-juicio.dto';

export class UpdateJuicioDto extends PartialType(
  OmitType(CreateJuicioDto, ['participantes'] as const),
) {
  participantes?: Array<{
    participanteId: string;
    rol?: string;
  }>;
}
