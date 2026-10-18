import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { fabricaErroresValidacion } from './common/validacion/mensajes-validacion';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix('api');
  app.use(cookieParser());
  // El registro de estudiantes envía la lista completa (hasta 1000 filas) para la
  // vista previa: el límite por defecto de 100 kb se queda corto.
  app.useBodyParser('json', { limit: '2mb' });

  // Valida y transforma los DTOs entrantes; rechaza propiedades extra.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, forbidNonWhitelisted: true, transform: true,
      // Los mensajes por defecto de class-validator están en inglés y llegan tal cual al usuario.
      exceptionFactory: fabricaErroresValidacion,
    }),
  );

  // Errores no controlados: log interno completo, respuesta genérica sin stack traces.
  app.useGlobalFilters(new GlobalExceptionFilter());

  // CLIENT_ORIGIN admite VARIOS orígenes separados por coma. En producción el
  // dominio propio se sirve como apex y como www (https://midominio.com,
  // https://www.midominio.com) y ambos deben poder hablar con el API; con un
  // único valor, el que sobrara recibía un CORS fallido difícil de diagnosticar.
  const origenes = (process.env.CLIENT_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  app.enableCors({
    origin: origenes,
    credentials: true, // necesario para la cookie httpOnly del JWT
  });

  const port = parseInt(process.env.PORT ?? '4000', 10);
  await app.listen(port);
  console.log(`[api] PREXI UPEA escuchando en http://localhost:${port}/api`);
}

bootstrap();
