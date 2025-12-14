import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SendEmailDto, SendEmailResult } from './dto/send-email.dto';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly stubMode: boolean;
  private readonly smtpEnabled: boolean;

  constructor(private configService: ConfigService) {
    // Por defecto usar modo stub, a menos que se configure SMTP
    this.smtpEnabled =
      this.configService.get<string>('SMTP_HOST') !== undefined &&
      this.configService.get<string>('SMTP_HOST') !== '';
    this.stubMode = !this.smtpEnabled;

    if (this.stubMode) {
      this.logger.log(
        'EmailService iniciado en modo STUB (no se envían emails reales)',
      );
    } else {
      this.logger.log('EmailService iniciado con SMTP configurado');
    }
  }

  async sendEmail(dto: SendEmailDto): Promise<SendEmailResult> {
    if (this.stubMode) {
      return this.sendEmailStub(dto);
    }

    // Aquí se podría integrar nodemailer u otro servicio SMTP
    // Por ahora, si no está en modo stub pero no hay implementación, usar stub
    this.logger.warn('SMTP configurado pero no implementado, usando modo stub');
    return this.sendEmailStub(dto);
  }

  private async sendEmailStub(dto: SendEmailDto): Promise<SendEmailResult> {
    // Simular latencia de red
    await new Promise((resolve) =>
      setTimeout(resolve, 50 + Math.random() * 100),
    );

    // Simular tasa de éxito del 95%
    const success = Math.random() > 0.05;

    if (success) {
      const messageId = `stub-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      this.logger.debug(
        `[STUB] Email enviado a ${dto.to}: ${dto.subject} (ID: ${messageId})`,
      );
      return {
        success: true,
        messageId,
      };
    } else {
      // Simular diferentes tipos de errores
      const errorTypes = [
        { code: 'SMTP_TIMEOUT', message: 'Connection timeout' },
        { code: 'SMTP_ERROR', message: 'SMTP server error' },
        { code: 'NETWORK_ERROR', message: 'Network error' },
      ];
      const error = errorTypes[Math.floor(Math.random() * errorTypes.length)];

      this.logger.warn(
        `[STUB] Error simulado al enviar email a ${dto.to}: ${error.message}`,
      );
      return {
        success: false,
        errorCode: error.code,
        errorMessage: error.message,
      };
    }
  }

  /**
   * Verifica si el servicio está en modo stub
   */
  isStubMode(): boolean {
    return this.stubMode;
  }
}
