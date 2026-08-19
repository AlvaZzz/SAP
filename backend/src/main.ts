import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.use(cookieParser());

  // Valida y transforma los DTOs entrantes; rechaza propiedades extra.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
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
