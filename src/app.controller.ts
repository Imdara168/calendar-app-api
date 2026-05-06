import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getHealth() {
    return {
      app: 'calendar-app-api',
      status: 'ok',
      database: 'calendar-database.sqlite',
      timestamp: new Date().toISOString(),
    };
  }
}
