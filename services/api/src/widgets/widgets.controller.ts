import { Body, Controller, Get, Put } from '@nestjs/common';
import { AuthMode } from '../auth/auth-mode';
import { parseDashboardLayout, type DashboardLayout } from './dashboard-layout-request';
import { WidgetsService, type WidgetRegistryEntry } from './widgets.service';

// The registry says which widgets are deployed — not user data, so anonymous hosts may read it.
@AuthMode('optional')
@Controller('widgets')
export class WidgetsController {
  constructor(private readonly widgetsService: WidgetsService) {}

  @Get()
  findAll(): WidgetRegistryEntry[] {
    return this.widgetsService.findAll();
  }
}

// The layout is per user, so it needs a valid access token (the global guard's default mode).
@Controller('dashboard')
export class DashboardLayoutController {
  constructor(private readonly widgetsService: WidgetsService) {}

  @Get('layout')
  getLayout(): DashboardLayout {
    return this.widgetsService.getLayout();
  }

  @Put('layout')
  saveLayout(@Body() body: unknown): DashboardLayout {
    return this.widgetsService.saveLayout(parseDashboardLayout(body));
  }
}
