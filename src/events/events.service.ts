import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CalendarEventEntity } from './calendar-event.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { UserEntity } from '../users/user.entity';
import { resolveEventStatus } from '../common/event-status.util';
import { ReportEntity } from '../reports/report.entity';
import { DocumentsService } from '../documents/documents.service';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(CalendarEventEntity)
    private readonly eventsRepository: Repository<CalendarEventEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectRepository(ReportEntity)
    private readonly reportsRepository: Repository<ReportEntity>,
    private readonly documentsService: DocumentsService,
  ) {}

  async findAll(
    userId: number,
    date?: string,
    startDate?: string,
    endDate?: string,
  ) {
    const events = await this.eventsRepository.find({
      where: {
        user: { id: userId },
      },
      relations: {
        user: true,
      },
      order: {
        date: 'ASC',
        startTime: 'ASC',
      },
    });

    const refreshedEvents = await Promise.all(
      events.map((event) => this.refreshStatus(event)),
    );

    return refreshedEvents
      .filter((event) => {
        if (date) {
          return event.date === date;
        }

        if (startDate && endDate) {
          return event.date >= startDate && event.date <= endDate;
        }

        return true;
      })
      .map((event) => this.serializeEvent(event));
  }

  async create(userId: number, dto: CreateEventDto) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new ForbiddenException('User not found');
    }

    const event = this.eventsRepository.create({
      title: dto.title.trim(),
      description: dto.description?.trim() ?? '',
      date: dto.date,
      startTime: dto.startTime,
      endTime: dto.endTime,
      status: resolveEventStatus(dto.date, dto.startTime, dto.endTime),
      category: dto.category,
      user,
      attendees: dto.attendees.map((name) => name.trim()),
      attachments: this.normalizeAttachments(dto.attachments),
    });

    const saved = await this.eventsRepository.save(event);
    await this.syncAttachmentsToReports(userId, saved.attachments, saved.date);
    return this.serializeEvent(saved);
  }

  async update(userId: number, eventId: number, dto: UpdateEventDto) {
    const event = await this.getOwnedEvent(userId, eventId);

    if (dto.title !== undefined) {
      event.title = dto.title.trim();
    }

    if (dto.description !== undefined) {
      event.description = dto.description.trim();
    }

    if (dto.date !== undefined) {
      event.date = dto.date;
    }

    if (dto.startTime !== undefined) {
      event.startTime = dto.startTime;
    }

    if (dto.endTime !== undefined) {
      event.endTime = dto.endTime;
    }

    if (dto.category !== undefined) {
      event.category = dto.category;
    }

    if (dto.attendees !== undefined) {
      event.attendees = dto.attendees.map((name) => name.trim());
    }

    if (dto.attachments !== undefined) {
      event.attachments = this.normalizeAttachments(dto.attachments);
    }

    event.status = resolveEventStatus(
      event.date,
      event.startTime,
      event.endTime,
    );

    if (dto.attachments !== undefined || dto.date !== undefined) {
      await this.syncAttachmentsToReports(
        userId,
        event.attachments,
        event.date,
      );
    }

    const saved = await this.eventsRepository.save(event);
    return this.serializeEvent(saved);
  }

  async remove(userId: number, eventId: number) {
    const event = await this.getOwnedEvent(userId, eventId);
    await this.eventsRepository.remove(event);
    return { success: true };
  }

  private async getOwnedEvent(userId: number, eventId: number) {
    const event = await this.eventsRepository.findOne({
      where: {
        id: eventId,
        user: { id: userId },
      },
      relations: {
        user: true,
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    return event;
  }

  private async refreshStatus(event: CalendarEventEntity) {
    const nextStatus = resolveEventStatus(
      event.date,
      event.startTime,
      event.endTime,
    );

    if (nextStatus !== event.status) {
      event.status = nextStatus;
      return this.eventsRepository.save(event);
    }

    return event;
  }

  private serializeEvent(event: CalendarEventEntity) {
    return {
      id: event.id,
      title: event.title,
      description: event.description,
      date: event.date,
      startTime: event.startTime,
      endTime: event.endTime,
      status: event.status,
      category: event.category,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
      attendees: event.attendees ?? [],
      attachments: this.normalizeAttachments(event.attachments),
    };
  }

  private normalizeAttachments(
    attachments:
      | {
          fileName: string;
          fileType: string;
          fileSize: number;
          fileUrl: string;
        }[]
      | {
          fileName: string;
          fileType: string;
          fileSize: number;
          fileUrl: string;
        }
      | null
      | undefined,
  ) {
    if (!attachments) {
      return [];
    }

    return (Array.isArray(attachments) ? attachments : [attachments]).filter(
      (attachment) => attachment?.fileUrl,
    );
  }

  private async syncAttachmentsToReports(
    userId: number,
    attachments:
      | {
          fileName: string;
          fileType: string;
          fileSize: number;
          fileUrl: string;
        }[]
      | null
      | undefined,
    date: string,
  ) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new ForbiddenException('User not found');
    }

    for (const attachment of this.normalizeAttachments(attachments)) {
      const existing = await this.findReportByFileUrl(
        userId,
        attachment.fileUrl,
      );

      if (!existing) {
        const report = this.reportsRepository.create({
          user,
          date,
          uploadedReport: JSON.stringify({
            fileUrl: attachment.fileUrl,
            fileName: attachment.fileName,
            fileType: attachment.fileType,
          }),
        });

        await this.reportsRepository.save(report);
      } else {
        existing.date = date;
        existing.uploadedReport = JSON.stringify({
          fileUrl: attachment.fileUrl,
          fileName: attachment.fileName,
          fileType: attachment.fileType,
        });
        await this.reportsRepository.save(existing);
      }

      await this.documentsService.syncUploadedFile({
        userId,
        fileUrl: attachment.fileUrl,
        fileName: attachment.fileName,
        fileType: attachment.fileType,
        fileSize: attachment.fileSize,
        date,
      });
    }
  }

  private async findReportByFileUrl(userId: number, fileUrl: string) {
    const reports = await this.reportsRepository.find({
      where: {
        user: { id: userId },
      },
      relations: {
        user: true,
      },
    });

    return reports.find((report) => {
      try {
        const parsed = JSON.parse(report.uploadedReport);
        return parsed?.fileUrl === fileUrl;
      } catch {
        return report.uploadedReport === fileUrl;
      }
    });
  }
}
