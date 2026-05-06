import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthenticatedUser } from './authenticated-user.interface';

type AuthenticatedRequest = {
  headers: {
    authorization?: string | string[];
  };
  user?: AuthenticatedUser;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<unknown>() as AuthenticatedRequest;
    const authorization = request.headers.authorization;
    const authHeader = Array.isArray(authorization)
      ? authorization[0]
      : authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = authHeader.slice(7);

    try {
      const payload = await this.jwtService.verifyAsync<AuthenticatedUser>(
        token,
        {
          secret:
            this.configService.get<string>('JWT_SECRET') ??
            'calendar-secret-key',
        },
      );
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
