import { Module } from '@nestjs/common';
import { JuiciosService } from './juicios.service';
import { JuiciosController } from './juicios.controller';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, NotificacionesModule],
  controllers: [JuiciosController],
  providers: [JuiciosService],
  exports: [JuiciosService],
})
export class JuiciosModule {}
