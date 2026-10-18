import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../common/auth/jwt.guard';
import { MailModule } from '../common/mail/mail.module';
import { RecuperacionService } from './recuperacion/recuperacion.service';
import { RecuperacionAprobacionController, RecuperacionPublicaController } from './recuperacion/recuperacion.controller';

@Module({
  imports: [
    MailModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') ?? 'dev_secret',
        // Access token CORTO: si la cookie se filtra, la ventana de abuso es de
        // minutos. La continuidad de la sesión la da el refresh token rotatorio
        // (ver RefreshToken en el esquema y AuthService.refrescar).
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN') ?? '15m' },
      }),
    }),
  ],
  controllers: [AuthController, RecuperacionPublicaController, RecuperacionAprobacionController],
  providers: [AuthService, JwtAuthGuard, RecuperacionService],
  exports: [JwtModule, AuthService],
})
export class AuthModule {}
