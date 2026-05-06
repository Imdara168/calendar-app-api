import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { CalendarEventEntity } from './calendar-event.entity';
import { UserEntity } from '../users/user.entity';
import { AuthModule } from '../auth/auth.module';
import { ReportEntity } from '../reports/report.entity';
import { DocumentsModule } from '../documents/documents.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CalendarEventEntity, UserEntity, ReportEntity]),
    AuthModule,
    DocumentsModule,
  ],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
