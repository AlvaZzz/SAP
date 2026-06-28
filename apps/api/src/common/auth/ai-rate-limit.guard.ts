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
    if (user.rol !== 'estudiante') return true;

    const limite = parseInt(this.config.get('AI_RATE_LIMIT_PER_HOUR') ?? '20', 10);
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
    // Registra el uso ANTES de llamar a Gemini.
    await this.prisma.consultaIa.create({ data: { usuarioId: user.sub, endpoint: req.path } });
    return true;
  }
}
