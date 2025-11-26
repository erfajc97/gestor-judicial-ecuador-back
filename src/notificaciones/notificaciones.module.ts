import { Module, forwardRef } from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';
import { TelegramModule } from '../telegram/telegram.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [PrismaModule, forwardRef(() => TelegramModule), AuditoriaModule],
  providers: [NotificacionesService],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
