import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { JuiciosService } from './juicios.service';
import { CreateJuicioDto } from './dto/create-juicio.dto';
import { UpdateJuicioDto } from './dto/update-juicio.dto';
import { AddParticipanteDto } from './dto/add-participante.dto';

@Controller('juicios')
export class JuiciosController {
  constructor(private readonly juiciosService: JuiciosService) {}

  @Post()
  create(@Body() createJuicioDto: CreateJuicioDto) {
    return this.juiciosService.create(createJuicioDto);
  }

  @Get()
  findAll(@Query('search') search?: string) {
    return this.juiciosService.findAll(search);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.juiciosService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateJuicioDto: UpdateJuicioDto) {
    return this.juiciosService.update(id, updateJuicioDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.juiciosService.remove(id);
  }

  @Post(':id/participantes')
  addParticipante(
    @Param('id') id: string,
    @Body() addParticipanteDto: AddParticipanteDto,
  ) {
    return this.juiciosService.addParticipante(id, addParticipanteDto);
  }

  @Delete(':id/participantes/:participanteId')
  removeParticipante(
    @Param('id') id: string,
    @Param('participanteId') participanteId: string,
  ) {
    return this.juiciosService.removeParticipante(id, participanteId);
  }
}
