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

    try {
      console.log(
        '📝 Creando juicio con datos:',
        JSON.stringify(createJuicioDto, null, 2),
      );

      // Validar que los participantes existan antes de crear el juicio
      if (participantes && participantes.length > 0) {
        console.log(`🔍 Validando ${participantes.length} participante(s)...`);
        for (const p of participantes) {
          if (!p.participanteId || p.participanteId.trim() === '') {
            throw new NotFoundException(
              'El ID del participante no puede estar vacío',
            );
          }
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const participante =
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            await (this.prisma as any).participante.findUnique({
              where: { id: p.participanteId.trim() },
            });
          if (!participante) {
            console.error(
              `❌ Participante con ID "${p.participanteId}" no encontrado`,
            );
            throw new NotFoundException(
              `Participante con ID "${p.participanteId}" no encontrado`,
            );
          }
          console.log(`✅ Participante "${p.participanteId}" encontrado`);
        }
      }

      // Validar formato de fecha
      if (!juicioData.fecha || typeof juicioData.fecha !== 'string') {
        throw new Error('La fecha es requerida y debe ser una cadena de texto');
      }

      // Validar que la fecha esté en formato ISO (YYYY-MM-DD)
      const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!fechaRegex.test(juicioData.fecha)) {
        console.error(`❌ Formato de fecha inválido: "${juicioData.fecha}"`);
        throw new Error(
          `Formato de fecha inválido: "${juicioData.fecha}". Debe ser YYYY-MM-DD`,
        );
      }

      // Convertir fecha y hora a DateTime para Prisma
      // Combinar fecha (YYYY-MM-DD) con hora (HH:MM) para crear un DateTime completo
      const fechaHoraCompleta = `${juicioData.fecha}T${juicioData.hora}:00`;
      const fechaDateTime = new Date(fechaHoraCompleta);

      // Validar que la fecha sea válida
      if (isNaN(fechaDateTime.getTime())) {
        console.error(
          `❌ Fecha y hora inválidas: "${juicioData.fecha}" "${juicioData.hora}"`,
        );
        throw new Error(
          `Fecha y hora inválidas: "${juicioData.fecha}" "${juicioData.hora}"`,
        );
      }

      console.log(
        '✅ Validaciones pasadas. Creando juicio en la base de datos...',
      );
      console.log(`📅 Fecha DateTime: ${fechaDateTime.toISOString()}`);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const juicio = await (this.prisma as any).juicio.create({
        data: {
          ...juicioData,
          fecha: fechaDateTime, // Usar el DateTime completo en lugar de solo la fecha
          participantes: participantes
            ? {
                create: participantes.map((p) => ({
                  participanteId: p.participanteId.trim(),
                  rol: p.rol?.trim() || undefined,
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

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      console.log('✅ Juicio creado exitosamente:', juicio.id);

      // Enviar notificaciones
      if (participantes && participantes.length > 0) {
        this.notificacionesService
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
          .notificarCreacionJuicio(juicio.id)
          .catch((error) => {
            console.error('⚠️ Error enviando notificaciones:', error);
          });
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return juicio;
    } catch (error) {
      console.error('❌ Error creando juicio:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      // Si es un error de Prisma, extraer el mensaje
      if (error && typeof error === 'object' && 'message' in error) {
        const errorMessage = (error as { message: string }).message;
        console.error('📋 Mensaje de error:', errorMessage);
        throw new Error(`Error al crear el juicio: ${errorMessage}`);
      }
      throw error;
    }
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
