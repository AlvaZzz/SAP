import { CanActivate, ExecutionContext, Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from './jwt.guard';

/**
 * Limita las llamadas a la IA por estudiante (máx. N/hora, configurable con
 * AI_RATE_LIMIT_PER_HOUR). Registra cada uso en consultas_ia (auditoría de
 * costos). Docente/admin no se limitan. Usar DESPUÉS de JwtAuthGuard.
 */
@Injectable()
export class AiRateLimitGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<{ user?: JwtPayload; path: string }>();
    const user = req.user;
    if (!user) return false;

    // Interruptor global de PREXI (config central). Aplica a todos los roles.
    const cfg = await this.prisma.configuracionSistema.findUnique({ where: { id: 1 } }).catch(() => null);
    if (cfg && cfg.iaActiva === false) {
      throw new HttpException('PREXI está desactivado por el administrador.', HttpStatus.SERVICE_UNAVAILABLE);
    }

    if (user.rol !== 'estudiante') return true;

    // Límite por hora: config central > variable de entorno > 20 por defecto.
    const limite = cfg?.rateLimitIaHora ?? parseInt(this.config.get('AI_RATE_LIMIT_PER_HOUR') ?? '20', 10);
    const desde = new Date(Date.now() - 60 * 60 * 1000);
    const usados = await this.prisma.consultaIa.count({
      where: { usuarioId: user.sub, fecha: { gt: desde } },
    });
    if (usados >= limite) {
      throw new HttpException(
        `Límite de ${limite} consultas IA por hora alcanzado. Intenta más tarde.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    // El detalle de cada consulta (tipo, pregunta, respuesta) lo registra
    // TutorIaService tras responder; aquí solo contamos para el límite.
    return true;
  }
}
