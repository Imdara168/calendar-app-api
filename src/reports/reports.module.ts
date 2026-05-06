import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportEntity } from './report.entity';
import { AuthModule } from '../auth/auth.module';
import { CalendarEventEntity } from '../events/calendar-event.entity';
import { DocumentsModule } from '../documents/documents.module';
import { UserEntity } from '../users/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReportEntity, CalendarEventEntity, UserEntity]),
    AuthModule,
    DocumentsModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
