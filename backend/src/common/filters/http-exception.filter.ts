import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Filtro global de excepciones (producción):
 *  - Los HttpException (validaciones, guards, reglas de negocio) pasan tal cual:
 *    sus mensajes ya están pensados para el usuario y en español.
 *  - Cualquier error NO controlado (bug, caída de BD, etc.) se LOGUEA completo
 *    en el servidor pero al cliente solo le llega un mensaje genérico:
 *    nunca stack traces ni detalles internos.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Excepciones');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      res.status(status).json(typeof body === 'string' ? { statusCode: status, message: body } : body);
      return;
    }

    // Error no controlado: registro interno completo, respuesta genérica.
    const err = exception as Error;
    this.logger.error(`${req.method} ${req.url} → ${err?.message ?? exception}`, err?.stack);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: 500,
      message: 'Ocurrió un error inesperado. Inténtalo de nuevo en unos minutos.',
    });
  }
}
