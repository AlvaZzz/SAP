import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Envío de correo CONFIGURABLE por variables de entorno (SMTP).
 *
 * - Si SMTP_HOST está configurado, envía el correo real vía `nodemailer`
 *   (dependencia opcional: `npm i nodemailer`). La importación es dinámica para
 *   que el proyecto compile y corra sin el paquete cuando aún no hay servidor
 *   de correo (p. ej. en desarrollo o en la defensa de la tesis).
 * - Si NO hay SMTP configurado, NO se cae: registra el enlace en los logs para
 *   poder probar el flujo end-to-end en desarrollo.
 *
 * Toda la plomería de tokens/hashing vive en AuthService; este servicio solo
 * entrega el mensaje.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  private get smtpConfigurado(): boolean {
    return !!this.config.get<string>('SMTP_HOST');
  }

  /** Envía (o registra en dev) el enlace de restablecimiento de contraseña. */
  async enviarRecuperacion(destino: string, nombre: string, enlace: string): Promise<void> {
    const remitente = this.config.get<string>('MAIL_FROM') ?? 'PREXI <no-reply@prexi.local>';
    const asunto = 'Restablece tu contraseña · PREXI';
    const nombreSeguro = nombre?.trim() || 'estudiante';
    const texto = [
      `Hola ${nombreSeguro},`,
      '',
      'Recibimos una solicitud para restablecer tu contraseña en PREXI.',
      'Abre el siguiente enlace para crear una nueva contraseña (expira en 45 minutos):',
      '',
      enlace,
      '',
      'Si no solicitaste este cambio, ignora este mensaje: tu contraseña seguirá igual.',
    ].join('\n');
    const html = this.plantillaHtml(nombreSeguro, enlace);

    if (!this.smtpConfigurado) {
      // Sin SMTP: dejamos el enlace visible en los logs SOLO en desarrollo.
      this.logger.warn(
        `[MAIL:dev] SMTP no configurado. Enlace de recuperación para ${destino}:\n${enlace}`,
      );
      return;
    }

    try {
      // Import dinámico (expresión no literal) → no exige el paquete en compilación.
      const modulo = 'nodemailer';
      const nodemailer = (await import(modulo)) as unknown as {
        createTransport: (opts: unknown) => { sendMail: (m: unknown) => Promise<unknown> };
      };
      const transport = nodemailer.createTransport({
        host: this.config.get<string>('SMTP_HOST'),
        port: parseInt(this.config.get<string>('SMTP_PORT') ?? '587', 10),
        secure: this.config.get<string>('SMTP_SECURE') === 'true',
        auth: this.config.get<string>('SMTP_USER')
          ? { user: this.config.get<string>('SMTP_USER'), pass: this.config.get<string>('SMTP_PASS') }
          : undefined,
      });
      await transport.sendMail({ from: remitente, to: destino, subject: asunto, text: texto, html });
      this.logger.log(`Correo de recuperación enviado a ${destino}`);
    } catch (e) {
      // Nunca revelamos al cliente si el envío falló (respuesta genérica en el
      // controlador). Registramos el error y el enlace para no bloquear pruebas.
      this.logger.error(`No se pudo enviar el correo de recuperación: ${e instanceof Error ? e.message : e}`);
      this.logger.warn(`[MAIL:fallback] Enlace de recuperación para ${destino}:\n${enlace}`);
    }
  }

  private plantillaHtml(nombre: string, enlace: string): string {
    return `<!doctype html><html lang="es"><body style="margin:0;background:#f1f5f9;font-family:Segoe UI,Arial,sans-serif;color:#0f172a">
  <div style="max-width:480px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
    <div style="background:#2C4A6E;padding:20px 28px;color:#fff;font-size:20px;font-weight:700">PREXI</div>
    <div style="padding:28px">
      <p style="margin:0 0 12px">Hola <strong>${nombre}</strong>,</p>
      <p style="margin:0 0 16px;line-height:1.6">Recibimos una solicitud para restablecer tu contraseña. Pulsa el botón para crear una nueva. El enlace expira en <strong>45 minutos</strong>.</p>
      <p style="text-align:center;margin:24px 0">
        <a href="${enlace}" style="background:#2C4A6E;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;display:inline-block">Restablecer contraseña</a>
      </p>
      <p style="margin:0 0 8px;font-size:13px;color:#64748b">Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
      <p style="margin:0 0 16px;font-size:12px;word-break:break-all;color:#2C4A6E">${enlace}</p>
      <p style="margin:0;font-size:13px;color:#64748b">Si no solicitaste este cambio, ignora este mensaje: tu contraseña seguirá igual.</p>
    </div>
  </div>
</body></html>`;
  }
}
