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
      select: {
        id: true,
        name: true,
        scenario: true,
        channelTarget: true,
        totalMessages: true,
        concurrency: true,
        ratePerSec: true,
        status: true,
      },
    })) as {
      id: string;
      name: string;
      scenario: string;
      channelTarget: unknown;
      totalMessages: number;
      concurrency: number;
      ratePerSec: number | null;
      status: ExperimentStatus;
    } | null;

    if (!experiment) {
      throw new NotFoundException(`Experimento ${id} no encontrado`);
    }

    if (experiment.status === ExperimentStatus.RUNNING) {
      throw new Error('El experimento ya está en ejecución');
    }

    // Validar configuración requerida antes de iniciar (solo si no es dryRun)
    // La validación se hace aquí para fallar rápido antes de cambiar el estado
    // Si es dryRun, la validación se omite en el runner
    try {
      this.runner.validateExperimentConfig(
        experiment as unknown as Parameters<
          typeof this.runner.validateExperimentConfig
        >[0],
        dryRun ?? false,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error de validación';
      this.logger.error(
        `Validación fallida para experimento ${id}: ${errorMessage}`,
      );
      throw error;
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

  /**
   * Elimina un experimento y todos sus datos relacionados
   */
  async delete(id: string): Promise<void> {
    // Verificar que el experimento existe
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const experiment = (await (this.prisma as any).experimentRun.findUnique({
      where: { id },
      select: { id: true, status: true, name: true },
    })) as { id: string; status: ExperimentStatus; name: string } | null;

    if (!experiment) {
      throw new NotFoundException(`Experimento ${id} no encontrado`);
    }

    // Validar que no esté en ejecución
    if (experiment.status === ExperimentStatus.RUNNING) {
      throw new Error(
        'No se puede eliminar un experimento que está en ejecución. Espere a que termine o falle.',
      );
    }

    this.logger.log(
      `Eliminando experimento ${id} - ${experiment.name} y todos sus datos relacionados`,
    );

    // Eliminar en cascada: primero los datos relacionados, luego el experimento
    try {
      // Eliminar metricEvents relacionados
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await (this.prisma as any).metricEvent.deleteMany({
        where: { experimentRunId: id },
      });

      // Eliminar seriesPoints relacionados
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await (this.prisma as any).experimentSeriesPoint.deleteMany({
        where: { experimentRunId: id },
      });

      // Eliminar el experimento
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await (this.prisma as any).experimentRun.delete({
        where: { id },
      });

      this.logger.log(`Experimento ${id} eliminado exitosamente`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(
        `Error eliminando experimento ${id}: ${errorMessage}`,
        error,
      );
      throw new Error(`Error al eliminar el experimento: ${errorMessage}`);
    }
  }
}
