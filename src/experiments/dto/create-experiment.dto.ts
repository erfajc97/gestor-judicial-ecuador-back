import {
  IsString,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import {
  ExperimentScenario,
  NotificationChannel,
} from '../../../generated/prisma/enums';

export class CreateExperimentDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(ExperimentScenario)
  scenario!: ExperimentScenario;

  @IsEnum(NotificationChannel)
  channelTarget!: NotificationChannel;

  @IsInt()
  @Min(1)
  @Max(10000)
  totalMessages!: number;

  @IsInt()
  @Min(1)
  @Max(100)
  concurrency!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  ratePerSec?: number;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @IsOptional()
  @IsString()
  createdBy?: string;
}
