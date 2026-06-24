/** Error con código HTTP, capturado por el middleware de errores. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public detalle?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (msg: string, detalle?: unknown) => new HttpError(400, msg, detalle);
export const unauthorized = (msg = 'No autenticado') => new HttpError(401, msg);
export const forbidden = (msg = 'Sin permisos suficientes') => new HttpError(403, msg);
export const notFound = (msg = 'Recurso no encontrado') => new HttpError(404, msg);
export const tooMany = (msg: string) => new HttpError(429, msg);
