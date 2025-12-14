import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExperimentsRunnerService } from './experiments-runner.service';
import { CreateExperimentDto } from './dto/create-experiment.dto';
import { ExperimentStatus } from '../../generated/prisma/enums';

@Injectable()
export class ExperimentsService {
  private readonly logger = new Logger(ExperimentsService.name);

  constructor(
    private prisma: PrismaService,
    private runner: ExperimentsRunnerService,
  ) {}

  /**
   * Crea un nuevo experimento
   */
  async create(dto: CreateExperimentDto): Promise<unknown> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const experiment = (await (this.prisma as any).experimentRun.create({
      data: {
        name: dto.name,
        description: dto.description,
        scenario: dto.scenario,
        channelTarget: dto.channelTarget,
        totalMessages: dto.totalMessages,
        concurrency: dto.concurrency,
        ratePerSec: dto.ratePerSec,
        status: ExperimentStatus.CREATED,
        createdBy: dto.createdBy,
      },
    })) as { id: string };

    this.logger.log(`Experimento creado: ${experiment.id} - ${dto.name}`);
    return experiment;
  }

  /**
   * Lista todos los experimentos
   */
  async findAll(): Promise<unknown[]> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const experiments = await (this.prisma as any).experimentRun.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            metricEvents: true,
            seriesPoints: true,
          },
        },
      },
    });
    return experiments as unknown[];
  }

  /**
   * Obtiene un experimento por ID con detalles
   */
  async findOne(id: string): Promise<unknown> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const experiment = (await (this.prisma as any).experimentRun.findUnique({
      where: { id },
      include: {
        seriesPoints: {
          orderBy: { tOffsetSec: 'asc' },
        },
        _count: {
          select: {
            metricEvents: true,
            seriesPoints: true,
          },
        },
      },
    })) as { status: ExperimentStatus; seriesPoints?: unknown[] } | null;

    if (!experiment) {
      throw new NotFoundException(`Experimento ${id} no encontrado`);
    }

    return experiment as unknown;
  }

  /**
   * Ejecuta un experimento
   */
  async run(id: string, dryRun?: boolean): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const experiment = (await (this.prisma as any).experimentRun.findUnique({
      where: { id },
    })) as { status: ExperimentStatus } | null;

    if (!experiment) {
      throw new NotFoundException(`Experimento ${id} no encontrado`);
    }

    if (experiment.status === ExperimentStatus.RUNNING) {
      throw new Error('El experimento ya está en ejecución');
    }

    // Actualizar estado a RUNNING
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await (this.prisma as any).experimentRun.update({
      where: { id },
      data: {
        status: ExperimentStatus.RUNNING,
        startedAt: new Date(),
      },
    });

    // Ejecutar en background (no esperar)
    this.runner
      .runExperiment(
        experiment as unknown as Parameters<
          typeof this.runner.runExperiment
        >[0],
        dryRun ?? false,
      )
      .catch((error) => {
        this.logger.error(`Error ejecutando experimento ${id}:`, error);
        // Actualizar estado a FAILED
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        void (this.prisma as any).experimentRun.update({
          where: { id },
          data: {
            status: ExperimentStatus.FAILED,
            finishedAt: new Date(),
          },
        });
      });
  }
}
