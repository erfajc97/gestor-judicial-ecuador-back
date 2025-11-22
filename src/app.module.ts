import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { JuiciosModule } from './juicios/juicios.module';
import { ParticipantesModule } from './participantes/participantes.module';
import { TelegramModule } from './telegram/telegram.module';
import { NotificacionesModule } from './notificaciones/notificaciones.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    JuiciosModule,
    ParticipantesModule,
    TelegramModule,
    NotificacionesModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
