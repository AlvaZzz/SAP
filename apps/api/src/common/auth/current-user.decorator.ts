import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from './jwt.guard';

/**
 * Inyecta el usuario autenticado (del JWT) en un handler.
 * Uso: metodo(@CurrentUser() user: JwtPayload) o @CurrentUser('sub') id: number
 */
export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const user = req.user;
    return data && user ? user[data] : user;
  },
);
