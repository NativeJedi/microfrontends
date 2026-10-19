import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { clearAuthCookies, readCookie, REFRESH_TOKEN_COOKIE, setAuthCookies } from './auth-cookies';
import { AuthMode } from './auth-mode';
import { AuthService } from './auth.service';
import { parseLoginRequest } from './login-request';

// Tokens travel only in httpOnly cookies, so every endpoint answers 204 with Set-Cookie and no body.
@AuthMode('none')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(204)
  login(@Body() body: unknown, @Res({ passthrough: true }) response: Response): void {
    const { email, password } = parseLoginRequest(body);
    setAuthCookies(response, this.authService.login(email, password));
  }

  @Post('refresh')
  @HttpCode(204)
  refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response): void {
    try {
      setAuthCookies(response, this.authService.refresh(readCookie(request, REFRESH_TOKEN_COOKIE)));
    } catch (error) {
      // A dead session must not leave an expired access cookie behind: with it, even public endpoints
      // would keep answering 401 to an anonymous user.
      clearAuthCookies(response);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Req() request: Request, @Res({ passthrough: true }) response: Response): void {
    this.authService.logout(readCookie(request, REFRESH_TOKEN_COOKIE));
    clearAuthCookies(response);
  }
}
