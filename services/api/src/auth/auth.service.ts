import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RefreshTokensService } from './refresh-tokens.service';
import { findUserByCredentials } from './users';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly refreshTokens: RefreshTokensService,
  ) {}

  login(email: string, password: string): AuthTokens {
    const user = findUserByCredentials(email, password);
    if (!user) throw new UnauthorizedException('Invalid email or password');
    return {
      accessToken: this.signAccessToken(user.id),
      refreshToken: this.refreshTokens.issue(user.id),
    };
  }

  refresh(refreshToken: string | undefined): AuthTokens {
    const rotated = refreshToken ? this.refreshTokens.rotate(refreshToken) : undefined;
    if (!rotated)
      throw new UnauthorizedException('Refresh token is missing, expired or already used');
    return {
      accessToken: this.signAccessToken(rotated.userId),
      refreshToken: rotated.refreshToken,
    };
  }

  logout(refreshToken: string | undefined): void {
    if (refreshToken) this.refreshTokens.revoke(refreshToken);
  }

  private signAccessToken(userId: string): string {
    return this.jwtService.sign({ sub: userId });
  }
}
