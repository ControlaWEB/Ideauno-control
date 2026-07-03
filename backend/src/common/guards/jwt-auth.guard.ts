import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException(
        'Acceso no autorizado: Token no provisto.',
      );
    }
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      // Nunca verificar tokens contra un secret por defecto conocido
      throw new UnauthorizedException(
        'Configuración de autenticación incompleta.',
      );
    }
    try {
      const payload = await this.jwtService.verifyAsync(token, { secret });
      request.user = payload;
    } catch (err) {
      throw new UnauthorizedException(
        'Acceso no autorizado: Token inválido o expirado.',
      );
    }
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
