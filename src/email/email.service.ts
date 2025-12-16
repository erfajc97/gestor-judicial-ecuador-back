import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { SendEmailDto, SendEmailResult } from './dto/send-email.dto';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly stubMode: boolean;
  private readonly smtpEnabled: boolean;
  private readonly transporter: Transporter | null;

  constructor(private configService: ConfigService) {
    // Por defecto usar modo stub, a menos que se configure SMTP
    this.smtpEnabled =
      this.configService.get<string>('SMTP_HOST') !== undefined &&
      this.configService.get<string>('SMTP_HOST') !== '';
    this.stubMode = !this.smtpEnabled;

    let transporter: Transporter | null = null;

    if (!this.stubMode) {
      // Configurar transporter SMTP
      const smtpHost = this.configService.get<string>('SMTP_HOST') || '';
      const smtpPort = this.configService.get<number>('SMTP_PORT') || 587;
      const smtpUser = this.configService.get<string>('SMTP_USER') || '';
      const smtpPass = this.configService.get<string>('SMTP_PASS') || '';
      const smtpSecure = this.configService.get<string>('SMTP_SECURE') === 'true';

      try {
        transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpSecure, // true para 465, false para otros puertos
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        });

        this.logger.log(
          `EmailService iniciado con SMTP configurado (${smtpHost}:${smtpPort})`,
        );
      } catch (error) {
        this.logger.error('Error configurando SMTP:', error);
        this.logger.warn('EmailService volviendo a modo STUB');
        transporter = null;
      }
    }

    this.transporter = transporter;

    if (this.stubMode) {
      this.logger.log(
        'EmailService iniciado en modo STUB (no se envían emails reales)',
      );
    }
  }

  async sendEmail(dto: SendEmailDto): Promise<SendEmailResult> {
    if (this.stubMode || !this.transporter) {
      this.logger.warn(
        `[STUB MODE] Email NO enviado realmente a ${dto.to}. Modo stub activo o transporter no disponible.`,
      );
      this.logger.warn(
        `[STUB MODE] Verifique configuración SMTP: SMTP_HOST=${this.configService.get<string>('SMTP_HOST') || 'NO CONFIGURADO'}, SMTP_USER=${this.configService.get<string>('SMTP_USER') || 'NO CONFIGURADO'}`,
      );
      return this.sendEmailStub(dto);
    }

    try {
      const smtpFrom =
        this.configService.get<string>('SMTP_FROM') ||
        this.configService.get<string>('SMTP_USER') ||
        'noreply@example.com';

      const mailOptions = {
        from: smtpFrom,
        to: dto.to,
        subject: dto.subject,
        html: dto.html,
        text: dto.text,
      };

      this.logger.log(
        `[SMTP] Intentando enviar email a ${dto.to} desde ${smtpFrom} con asunto: ${dto.subject}`,
      );

      const startTime = Date.now();
      const info = await this.transporter.sendMail(mailOptions);
      const latencyMs = Date.now() - startTime;

      const messageId = info.messageId || `smtp-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      this.logger.log(
        `[SMTP] ✅ Email enviado exitosamente a ${dto.to} (messageId: ${messageId}, latency: ${latencyMs}ms, response: ${JSON.stringify(info.response)})`,
      );

      return {
        success: true,
        messageId,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorCode = error instanceof Error && 'code' in error
        ? String(error.code)
        : 'SMTP_ERROR';

      this.logger.error(
        `[SMTP] ❌ ERROR al enviar email a ${dto.to}: ${errorCode} - ${errorMessage}`,
      );
      if (error instanceof Error && error.stack) {
        this.logger.error(`[SMTP] Stack trace: ${error.stack}`);
      }
      if (error instanceof Error && 'response' in error) {
        this.logger.error(
          `[SMTP] Respuesta del servidor: ${JSON.stringify((error as any).response)}`,
        );
      }
      if (error instanceof Error && 'command' in error) {
        this.logger.error(
          `[SMTP] Comando fallido: ${JSON.stringify((error as any).command)}`,
        );
      }

      return {
        success: false,
        errorCode,
        errorMessage,
      };
    }
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
