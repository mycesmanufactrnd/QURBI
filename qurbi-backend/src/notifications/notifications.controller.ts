import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type { DeepPartial } from 'typeorm';
import { Notification, NotificationAudience } from '../entities';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  create(@Body() body: DeepPartial<Notification>) {
    return this.notificationsService.create(body);
  }

  @Get()
  findInbox(@Query('userId') userId: string, @Query('audience') audience: NotificationAudience) {
    return this.notificationsService.findInbox(userId, audience);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string) {
    return this.notificationsService.markRead(id);
  }

  @Patch('read-all')
  markAllRead(@Body() body: { userId: string; audience: NotificationAudience }) {
    return this.notificationsService.markAllRead(body.userId, body.audience);
  }

  @Patch(':id/clear')
  clear(@Param('id') id: string) {
    return this.notificationsService.clear(id);
  }

  @Patch('clear-all')
  clearAll(@Body() body: { userId: string; audience: NotificationAudience }) {
    return this.notificationsService.clearAll(body.userId, body.audience);
  }
}
