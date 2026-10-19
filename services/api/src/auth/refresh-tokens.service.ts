import { Injectable } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { REFRESH_TOKEN_TTL_MS } from './token-lifetimes';

interface RefreshTokenRecord {
  userId: string;
  // All tokens issued from one login share a family: revoking the family ends that login everywhere.
  familyId: string;
  used: boolean;
  expiresAt: number;
}

export interface RotatedRefreshToken {
  userId: string;
  refreshToken: string;
}

// Opaque random tokens kept in memory (lost on API restart, which logs everyone out).
@Injectable()
export class RefreshTokensService {
  private readonly records = new Map<string, RefreshTokenRecord>();

  issue(userId: string, familyId: string = randomUUID()): string {
    const refreshToken = randomBytes(32).toString('base64url');
    this.records.set(refreshToken, {
      userId,
      familyId,
      used: false,
      expiresAt: Date.now() + REFRESH_TOKEN_TTL_MS,
    });
    return refreshToken;
  }

  // Rotation: every refresh token works once. A second use means two clients hold the same token
  // (a race or a stolen token), so the whole family is revoked and both have to log in again.
  rotate(refreshToken: string): RotatedRefreshToken | undefined {
    const record = this.records.get(refreshToken);
    if (!record || record.expiresAt < Date.now()) return undefined;
    if (record.used) {
      this.revokeFamily(record.familyId);
      return undefined;
    }
    record.used = true;
    return { userId: record.userId, refreshToken: this.issue(record.userId, record.familyId) };
  }

  revoke(refreshToken: string): void {
    const record = this.records.get(refreshToken);
    if (record) this.revokeFamily(record.familyId);
  }

  private revokeFamily(familyId: string): void {
    for (const [token, record] of this.records) {
      if (record.familyId === familyId) this.records.delete(token);
    }
  }
}
