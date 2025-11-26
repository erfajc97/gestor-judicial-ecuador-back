import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { AuditoriaService, RegistrarErrorDto, FiltrosAuditoria } from './auditoria.service';
import { TipoError } from '../../generated/prisma/enums';

@Controller('auditoria')
export class AuditoriaController {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  @Get()
  findAll(
    @Query('tipoError') tipoError?: TipoError,
    @Query('entidad') entidad?: string,
    @Query('resuelto') resuelto?: string,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const filtros: FiltrosAuditoria = {};
    if (tipoError) filtros.tipoError = tipoError;
    if (entidad) filtros.entidad = entidad;
    if (resuelto !== undefined) {
      filtros.resuelto = resuelto === 'true';
    }
    if (fechaDesde) filtros.fechaDesde = new Date(fechaDesde);
    if (fechaHasta) filtros.fechaHasta = new Date(fechaHasta);
    if (limit) filtros.limit = parseInt(limit, 10);
    if (offset) filtros.offset = parseInt(offset, 10);

    return this.auditoriaService.findAll(filtros);
  }

  @Get('estadisticas')
  getEstadisticas() {
    return this.auditoriaService.getEstadisticas();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.auditoriaService.findOne(id);
  }

  @Patch(':id/resolver')
  marcarResuelto(@Param('id') id: string) {
    return this.auditoriaService.marcarResuelto(id);
  }

  @Post()
  registrarError(@Body() dto: RegistrarErrorDto) {
    return this.auditoriaService.registrarError(dto);
  }
}

