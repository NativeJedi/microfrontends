import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { ACCESS_TOKEN_COOKIE, readCookie } from './auth-cookies';
import { AUTH_MODE_KEY, type AuthModeValue } from './auth-mode';

// Global guard: every route is protected unless its controller or handler says otherwise (@AuthMode).
@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const mode = this.getAuthMode(context);
    if (mode === 'none') return true;

    const accessToken = readCookie(
      context.switchToHttp().getRequest<Request>(),
      ACCESS_TOKEN_COOKIE,
    );
    if (accessToken) {
      this.verify(accessToken);
      return true;
    }
    if (mode === 'optional') return true;
    throw new UnauthorizedException('Not logged in');
  }

  private getAuthMode(context: ExecutionContext): AuthModeValue {
    const mode = this.reflector.getAllAndOverride<AuthModeValue | undefined>(AUTH_MODE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    return mode ?? 'required';
  }

  private verify(accessToken: string): void {
    try {
      this.jwtService.verify(accessToken);
    } catch {
      throw new UnauthorizedException('Access token is invalid or expired');
    }
  }
}
