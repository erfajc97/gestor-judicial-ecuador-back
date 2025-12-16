import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ExperimentsService } from './experiments.service';
import { CreateExperimentDto } from './dto/create-experiment.dto';

@Controller('experiments')
export class ExperimentsController {
  constructor(private readonly experimentsService: ExperimentsService) {}

  @Post()
  async create(@Body() dto: CreateExperimentDto): Promise<unknown> {
    return this.experimentsService.create(dto);
  }

  @Get()
  async findAll(): Promise<unknown[]> {
    return this.experimentsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<unknown> {
    return this.experimentsService.findOne(id);
  }

  @Post(':id/run')
  async run(@Param('id') id: string, @Query('dryRun') dryRun?: string) {
    const isDryRun = dryRun === 'true' || dryRun === '1';
    await this.experimentsService.run(id, isDryRun);
    return { message: 'Experimento iniciado', id };
  }

  @Get(':id/export')
  async export(
    @Param('id') id: string,
    @Query('format') format: string = 'json',
    @Res() res: Response,
  ): Promise<void> {
    const experiment = (await this.experimentsService.findOne(id)) as {
      seriesPoints?: Array<{
        createdAt: Date | string;
        tOffsetSec: number;
        sentCount: number;
        successCount: number;
        failCount: number;
        p95LatencyMs: number | null;
      }>;
    };

    if (format === 'csv') {
      // Generar CSV
      const headers = [
        'Timestamp',
        'Offset (s)',
        'Sent',
        'Success',
        'Failed',
        'P95 Latency (ms)',
      ];
      const seriesPoints = experiment.seriesPoints || [];
      const rows = seriesPoints.map((point) => [
        new Date(point.createdAt).toISOString(),
        point.tOffsetSec.toString(),
        point.sentCount.toString(),
        point.successCount.toString(),
        point.failCount.toString(),
        point.p95LatencyMs?.toString() ?? '',
      ]);

      const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join(
        '\n',
      );

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="experiment-${id}-${Date.now()}.csv"`,
      );
      res.status(HttpStatus.OK).send(csv);
    } else {
      // JSON
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="experiment-${id}-${Date.now()}.json"`,
      );
      res.status(HttpStatus.OK).json(experiment);
    }
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.experimentsService.delete(id);
    return { message: 'Experimento eliminado', id };
  }
}
