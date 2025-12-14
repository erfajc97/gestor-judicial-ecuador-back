import {
  IsOptional,
  IsEnum,
  IsDateString,
  IsString,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  NotificationChannel,
  MetricStatus,
} from '../../../generated/prisma/enums';

export class MetricsSummaryQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;

  @IsOptional()
  @IsString()
  experimentRunId?: string;
}

export class MetricsLogsQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;

  @IsOptional()
  @IsEnum(MetricStatus)
  status?: MetricStatus;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;

  @IsOptional()
  @IsString()
  experimentRunId?: string;
}

export class MetricsLatencyQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;

  @IsOptional()
  @IsString()
  experimentRunId?: string;
}

export class MetricsThroughputQueryDto {
  @IsString()
  experimentRunId!: string;
}
