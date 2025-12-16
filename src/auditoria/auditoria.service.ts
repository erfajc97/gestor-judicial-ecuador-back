import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TipoError } from '../../generated/prisma/enums';

export interface RegistrarErrorDto {
  tipoError: TipoError;
  entidad: string;
  entidadId?: string;
  mensaje: string;
  detalles?: Record<string, unknown>;
  stackTrace?: string;
}

export interface FiltrosAuditoria {
  tipoError?: TipoError;
  entidad?: string;
  resuelto?: boolean;
  fechaDesde?: Date;
  fechaHasta?: Date;
  limit?: number;
  offset?: number;
}

@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger(AuditoriaService.name);

  constructor(private prisma: PrismaService) {}

  async registrarError(dto: RegistrarErrorDto): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await (this.prisma as any).auditoria.create({
        data: {
          tipoError: dto.tipoError,
          entidad: dto.entidad,
          entidadId: dto.entidadId,
          mensaje: dto.mensaje,
          detalles: dto.detalles || {},
          stackTrace: dto.stackTrace,
        },
      });
      this.logger.log(
        `Error registrado en auditoría: ${dto.tipoError} - ${dto.mensaje}`,
      );
    } catch (error) {
      this.logger.error('Error al registrar en auditoría:', error);
      // No lanzamos el error para no bloquear la operación principal
    }
  }

  async findAll(filtros?: FiltrosAuditoria) {
    const where: {
      tipoError?: TipoError;
      entidad?: string;
      resuelto?: boolean;
      createdAt?: {
        gte?: Date;
        lte?: Date;
      };
    } = {};

    if (filtros?.tipoError) {
      where.tipoError = filtros.tipoError;
    }

    if (filtros?.entidad) {
      where.entidad = filtros.entidad;
    }

    if (filtros?.resuelto !== undefined) {
      where.resuelto = filtros.resuelto;
    }

    if (filtros?.fechaDesde || filtros?.fechaHasta) {
      where.createdAt = {};
      if (filtros.fechaDesde) {
        where.createdAt.gte = filtros.fechaDesde;
      }
      if (filtros.fechaHasta) {
        where.createdAt.lte = filtros.fechaHasta;
      }
    }

    const limit = filtros?.limit || 50;
    const offset = filtros?.offset || 0;

    const [data, total] = (await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      (this.prisma as any).auditoria.findMany({
        where: Object.keys(where).length > 0 ? where : undefined,
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
        skip: offset,
      }),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      (this.prisma as any).auditoria.count({
        where: Object.keys(where).length > 0 ? where : undefined,
      }),
    ])) as [unknown[], number];

    return {
      data,
      total,
      limit,
      offset,
    };
  }

  async findOne(id: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return await (this.prisma as any).auditoria.findUnique({
      where: { id },
    });
  }

  async findByTipoError(tipoError: TipoError) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return await (this.prisma as any).auditoria.findMany({
      where: { tipoError },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findByEntidad(entidad: string, entidadId?: string) {
    const where: { entidad: string; entidadId?: string } = { entidad };
    if (entidadId) {
      where.entidadId = entidadId;
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return await (this.prisma as any).auditoria.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async marcarResuelto(id: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await (this.prisma as any).auditoria.update({
      where: { id },
      data: {
        resuelto: true,
        fechaResolucion: new Date(),
      },
    });
  }

  async getEstadisticas() {
    const total =
      (await // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      (this.prisma as any).auditoria.count()) as number;
    const noResueltos =
      (await // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      (this.prisma as any).auditoria.count({
      where: { resuelto: false },
      })) as number;
    const resueltos =
      (await // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      (this.prisma as any).auditoria.count({
      where: { resuelto: true },
      })) as number;

    // Obtener conteo por tipo de error
    const porTipo =
      (await // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      (this.prisma as any).auditoria.groupBy({
      by: ['tipoError'],
      _count: {
        tipoError: true,
      },
      })) as Array<{ tipoError: TipoError; _count: { tipoError: number } }>;

    const porEntidad =
      (await // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      (this.prisma as any).auditoria.groupBy({
      by: ['entidad'],
      _count: {
        entidad: true,
      },
      })) as Array<{ entidad: string; _count: { entidad: number } }>;

    return {
      total,
      noResueltos,
      resueltos,
      porTipo: porTipo.map((item) => ({
          tipoError: item.tipoError,
          cantidad: item._count.tipoError,
      })),
      porEntidad: porEntidad.map((item) => ({
          entidad: item.entidad,
          cantidad: item._count.entidad,
      })),
    };
  }
}
