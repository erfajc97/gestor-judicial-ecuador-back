import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { CreateJuicioDto } from './dto/create-juicio.dto';
import { UpdateJuicioDto } from './dto/update-juicio.dto';
import { AddParticipanteDto } from './dto/add-participante.dto';

@Injectable()
export class JuiciosService {
  constructor(
    private prisma: PrismaService,
    private notificacionesService: NotificacionesService,
  ) {}

  async create(createJuicioDto: CreateJuicioDto) {
    const { participantes, ...juicioData } = createJuicioDto;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const juicio = await (this.prisma as any).juicio.create({
      data: {
        ...juicioData,
        participantes: participantes
          ? {
              create: participantes.map((p) => ({
                participanteId: p.participanteId,
                rol: p.rol,
              })),
            }
          : undefined,
      },
      include: {
        participantes: {
          include: {
            participante: true,
          },
        },
      },
    });

    // Enviar notificaciones
    if (participantes && participantes.length > 0) {
      this.notificacionesService
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        .notificarCreacionJuicio(juicio.id)
        .catch((error) => {
          console.error('Error enviando notificaciones:', error);
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return juicio;
  }

  async findAll(search?: string) {
    const where: {
      OR?: Array<{
        numeroCaso?: { contains: string; mode?: 'insensitive' };
        tipoJuicio?: { contains: string; mode?: 'insensitive' };
        descripcion?: { contains: string; mode?: 'insensitive' };
      }>;
    } = {};

    if (search && search.trim()) {
      where.OR = [
        { numeroCaso: { contains: search.trim(), mode: 'insensitive' } },
        { tipoJuicio: { contains: search.trim(), mode: 'insensitive' } },
        { descripcion: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return await (this.prisma as any).juicio.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      include: {
        participantes: {
          include: {
            participante: true,
          },
        },
      },
      orderBy: {
        fecha: 'asc',
      },
    });
  }

  async findOne(id: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const juicio = await (this.prisma as any).juicio.findUnique({
      where: { id },
      include: {
        participantes: {
          include: {
            participante: true,
          },
        },
        notificaciones: true,
      },
    });

    if (!juicio) {
      throw new NotFoundException(`Juicio con ID ${id} no encontrado`);
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return juicio;
  }

  async update(id: string, updateJuicioDto: UpdateJuicioDto) {
    await this.findOne(id);

    // Excluir participantes del update ya que se manejan por separado
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { participantes, ...juicioData } = updateJuicioDto;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const updated = await (this.prisma as any).juicio.update({
      where: { id },
      data: juicioData,
      include: {
        participantes: {
          include: {
            participante: true,
          },
        },
      },
    });

    // Enviar notificaciones de actualización
    this.notificacionesService
      .notificarActualizacionJuicio(id)
      .catch((error) => {
        console.error('Error enviando notificaciones de actualización:', error);
      });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return (this.prisma as any).juicio.delete({
      where: { id },
    });
  }

  async addParticipante(
    juicioId: string,
    addParticipanteDto: AddParticipanteDto,
  ) {
    await this.findOne(juicioId);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return (this.prisma as any).juicioParticipante.create({
      data: {
        juicioId,
        participanteId: addParticipanteDto.participanteId,
        rol: addParticipanteDto.rol,
      },
      include: {
        participante: true,
      },
    });
  }

  async removeParticipante(juicioId: string, participanteId: string) {
    await this.findOne(juicioId);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return (this.prisma as any).juicioParticipante.delete({
      where: {
        juicioId_participanteId: {
          juicioId,
          participanteId,
        },
      },
    });
  }
}
