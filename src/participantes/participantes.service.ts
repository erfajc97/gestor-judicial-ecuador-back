import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { TipoError } from '../../generated/prisma/enums';
import { CreateParticipanteDto } from './dto/create-participante.dto';
import { UpdateParticipanteDto } from './dto/update-participante.dto';

@Injectable()
export class ParticipantesService {
  private readonly logger = new Logger(ParticipantesService.name);

  constructor(
    private prisma: PrismaService,
    private auditoriaService: AuditoriaService,
  ) {}

  async create(createParticipanteDto: CreateParticipanteDto) {
    try {
      // Validar que no exista un participante con el mismo telegramChatId si se proporciona
      if (createParticipanteDto.telegramChatId) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const existente = await (this.prisma as any).participante.findFirst({
          where: { telegramChatId: createParticipanteDto.telegramChatId },
        });
        if (existente) {
          await this.auditoriaService.registrarError({
            tipoError: TipoError.PARTICIPANTE_DUPLICADO,
            entidad: 'Participante',
            mensaje: `Intento de crear participante con telegramChatId duplicado: ${createParticipanteDto.telegramChatId}`,
            detalles: {
              telegramChatId: createParticipanteDto.telegramChatId,
              nombre: createParticipanteDto.nombre,
            },
          });
          throw new Error(
            `Ya existe un participante con el telegramChatId: ${createParticipanteDto.telegramChatId}`,
          );
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      return await (this.prisma as any).participante.create({
        data: createParticipanteDto,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('duplicado')) {
        throw error;
      }
      this.logger.error('Error al crear participante:', error);
      await this.auditoriaService.registrarError({
        tipoError: TipoError.DATABASE_ERROR,
        entidad: 'Participante',
        mensaje: `Error al crear participante: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        detalles: createParticipanteDto as unknown as Record<string, unknown>,
        stackTrace: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  async findAll(search?: string) {
    const where: {
      OR?: Array<{
        nombre?: { contains: string; mode?: 'insensitive' };
        email?: { contains: string; mode?: 'insensitive' };
        telefono?: { contains: string; mode?: 'insensitive' };
      }>;
    } = {};

    if (search && search.trim()) {
      where.OR = [
        { nombre: { contains: search.trim(), mode: 'insensitive' } },
        { email: { contains: search.trim(), mode: 'insensitive' } },
        { telefono: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return await (this.prisma as any).participante.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const participante = await (this.prisma as any).participante.findUnique({
      where: { id },
      include: {
        juicios: {
          include: {
            juicio: true,
          },
        },
      },
    });

    if (!participante) {
      throw new NotFoundException(`Participante con ID ${id} no encontrado`);
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return participante;
  }

  async update(id: string, updateParticipanteDto: UpdateParticipanteDto) {
    try {
      await this.findOne(id);

      // Validar telegramChatId duplicado si se está actualizando
      if (updateParticipanteDto.telegramChatId) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const existente = await (this.prisma as any).participante.findFirst({
          where: {
            telegramChatId: updateParticipanteDto.telegramChatId,
            NOT: { id },
          },
        });
        if (existente) {
          await this.auditoriaService.registrarError({
            tipoError: TipoError.PARTICIPANTE_DUPLICADO,
            entidad: 'Participante',
            entidadId: id,
            mensaje: `Intento de actualizar participante con telegramChatId duplicado: ${updateParticipanteDto.telegramChatId}`,
            detalles: {
              telegramChatId: updateParticipanteDto.telegramChatId,
            },
          });
          throw new Error(
            `Ya existe otro participante con el telegramChatId: ${updateParticipanteDto.telegramChatId}`,
          );
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      return await (this.prisma as any).participante.update({
        where: { id },
        data: updateParticipanteDto,
      });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        (error instanceof Error && error.message.includes('duplicado'))
      ) {
        throw error;
      }
      this.logger.error(`Error al actualizar participante ${id}:`, error);
      await this.auditoriaService.registrarError({
        tipoError: TipoError.DATABASE_ERROR,
        entidad: 'Participante',
        entidadId: id,
        mensaje: `Error al actualizar participante: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        detalles: updateParticipanteDto as unknown as Record<string, unknown>,
        stackTrace: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return await (this.prisma as any).participante.delete({
      where: { id },
    });
  }
}
