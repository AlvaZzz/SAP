import { Module } from '@nestjs/common';
import { MailService } from './mail.service';

/** Envío de correo (SMTP configurable). Reutilizable por cualquier dominio. */
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
