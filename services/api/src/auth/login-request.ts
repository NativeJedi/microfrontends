import { BadRequestException } from '@nestjs/common';

export interface LoginRequest {
  email: string;
  password: string;
}

// The request body is untrusted input: narrow it before it reaches the service.
export function parseLoginRequest(body: unknown): LoginRequest {
  const fields = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  if (typeof fields.email !== 'string' || typeof fields.password !== 'string') {
    throw new BadRequestException('email and password must be strings');
  }
  return { email: fields.email, password: fields.password };
}
