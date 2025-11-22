import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateParticipanteDto } from './dto/create-participante.dto';
import { UpdateParticipanteDto } from './dto/update-participante.dto';

@Injectable()
export class ParticipantesService {
  constructor(private prisma: PrismaService) {}

  async create(createParticipanteDto: CreateParticipanteDto) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return await (this.prisma as any).participante.create({
      data: createParticipanteDto,
    });
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
    await this.findOne(id);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return await (this.prisma as any).participante.update({
      where: { id },
      data: updateParticipanteDto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return await (this.prisma as any).participante.delete({
      where: { id },
    });
  }
}
