import { BadRequestException } from '@nestjs/common';
import type { DashboardLayoutEntry } from './widgets.service';

export interface DashboardLayout {
  widgets: DashboardLayoutEntry[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// The API stores settings without understanding them: only the widget that owns a settings object knows
// its shape, so the check stops at "a JSON object".
function isLayoutEntry(value: unknown): value is DashboardLayoutEntry {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    (value.size === undefined || typeof value.size === 'string') &&
    (value.settings === undefined || isRecord(value.settings))
  );
}

// The request body is untrusted input: narrow it before it reaches the service.
export function parseDashboardLayout(body: unknown): DashboardLayout {
  if (!isRecord(body) || !Array.isArray(body.widgets)) {
    throw new BadRequestException('widgets must be an array');
  }
  if (!body.widgets.every(isLayoutEntry)) {
    throw new BadRequestException('each widget needs an id and optional size / settings');
  }
  return { widgets: body.widgets };
}
