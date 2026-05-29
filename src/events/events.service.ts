import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CalendarEventEntity, EventAttachment } from './calendar-event.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { UserEntity } from '../users/user.entity';
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
        startDate: 'ASC',
      },
    });

    return events
      .filter((event) => {
        const eventDateStr = event.startDate.toISOString().slice(0, 10);
        if (date) {
          return eventDateStr === date;
        }

        if (startDate && endDate) {
          return eventDateStr >= startDate && eventDateStr <= endDate;
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
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      category: dto.category,
      user,
      attendees: dto.attendees.map((name) => name.trim()),
      attachments: this.normalizeAttachments(dto.attachments),
    });

    const saved = await this.eventsRepository.save(event);
    await this.syncAttachmentsToReports(
      userId,
      saved.attachments,
      saved.startDate,
    );
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

    if (dto.startDate !== undefined) {
      event.startDate = new Date(dto.startDate);
    }

    if (dto.endDate !== undefined) {
      event.endDate = new Date(dto.endDate);
    }

    if (dto.category !== undefined) {
      event.category = dto.category;
    }

    if (dto.attendees !== undefined) {
      event.attendees = dto.attendees.map((name) => name.trim());
    }

    const oldAttachments = [...(event.attachments || [])];

    if (dto.attachments !== undefined) {
      event.attachments = this.normalizeAttachments(dto.attachments);
    }

    if (dto.attachments !== undefined || dto.startDate !== undefined) {
      await this.syncAttachmentsToReports(
        userId,
        event.attachments,
        event.startDate,
      );
    }

    if (dto.attachments !== undefined) {
      const removedAttachments = oldAttachments.filter(
        (old) =>
          !event.attachments.some((curr) => curr.fileUrl === old.fileUrl),
      );

      if (removedAttachments.length > 0) {
        const fileUrlsToDelete = await this.getOrphanedAttachmentFileUrls(
          userId,
          eventId,
          removedAttachments,
        );

        if (fileUrlsToDelete.length > 0) {
          await this.deleteReportsByFileUrls(userId, fileUrlsToDelete);
          await this.documentsService.deleteUploadedFilesByUrls(
            userId,
            fileUrlsToDelete,
          );
        }
      }
    }

    const saved = await this.eventsRepository.save(event);
    return this.serializeEvent(saved);
  }

  async remove(userId: number, eventId: number) {
    const event = await this.getOwnedEvent(userId, eventId);
    const fileUrlsToDelete = await this.getOrphanedAttachmentFileUrls(
      userId,
      eventId,
      event.attachments,
    );

    await this.eventsRepository.delete(event.id);

    if (fileUrlsToDelete.length > 0) {
      await this.deleteReportsByFileUrls(userId, fileUrlsToDelete);
      await this.documentsService.deleteUploadedFilesByUrls(
        userId,
        fileUrlsToDelete,
      );
    }

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

  private getEventStatus(startDate: Date, endDate: Date): string {
    const today = new Date();

    if (today < startDate) {
      return 'upcoming';
    }

    if (today >= startDate && today <= endDate) {
      return 'in-progress';
    }

    return 'completed';
  }

  private serializeEvent(event: CalendarEventEntity) {
    return {
      id: event.id,
      title: event.title,
      description: event.description,
      startDate: event.startDate.toISOString(),
      endDate: event.endDate.toISOString(),
      status: this.getEventStatus(event.startDate, event.endDate),
      category: event.category,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
      attendees: event.attendees ?? [],
      attachments: this.normalizeAttachments(event.attachments),
    };
  }

  private normalizeAttachments(
    attachments: EventAttachment[] | EventAttachment | null | undefined,
  ): EventAttachment[] {
    if (!attachments) {
      return [];
    }

    return (Array.isArray(attachments) ? attachments : [attachments]).filter(
      (attachment) => this.hasFileUrl(attachment),
    );
  }

  private async syncAttachmentsToReports(
    userId: number,
    attachments: EventAttachment[] | null | undefined,
    startDate: Date,
  ) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new ForbiddenException('User not found');
    }

    const dateStr = startDate.toISOString().slice(0, 10);

    for (const attachment of this.normalizeAttachments(attachments)) {
      const existing = await this.findReportByFileUrl(
        userId,
        attachment.fileUrl,
      );

      if (!existing) {
        const report = this.reportsRepository.create({
          user,
          date: dateStr,
          uploadedReport: JSON.stringify({
            fileUrl: attachment.fileUrl,
            fileName: attachment.fileName,
            fileType: attachment.fileType,
          }),
        });

        await this.reportsRepository.save(report);
      } else {
        existing.date = dateStr;
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
        date: dateStr,
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
        const parsed: unknown = JSON.parse(report.uploadedReport);
        return this.isStoredReportReference(parsed)
          ? parsed.fileUrl === fileUrl
          : false;
      } catch {
        return report.uploadedReport === fileUrl;
      }
    });
  }

  private async getOrphanedAttachmentFileUrls(
    userId: number,
    eventId: number,
    attachments: EventAttachment[] | null | undefined,
  ) {
    const normalizedAttachments = this.normalizeAttachments(attachments);

    if (normalizedAttachments.length === 0) {
      return [];
    }

    const otherEvents = await this.eventsRepository.find({
      where: {
        user: { id: userId },
      },
      relations: {
        user: true,
      },
    });

    const otherEventsWithoutCurrent = otherEvents.filter(
      (event) => event.id !== eventId,
    );

    return normalizedAttachments
      .map((attachment) => attachment.fileUrl)
      .filter(
        (fileUrl, index, fileUrls) =>
          fileUrls.indexOf(fileUrl) === index &&
          !otherEventsWithoutCurrent.some((event) =>
            this.normalizeAttachments(event.attachments).some(
              (attachment) => attachment.fileUrl === fileUrl,
            ),
          ),
      );
  }

  private async deleteReportsByFileUrls(userId: number, fileUrls: string[]) {
    const reports = await this.reportsRepository.find({
      where: {
        user: { id: userId },
      },
      relations: {
        user: true,
      },
    });

    const matchingReportIds = reports
      .filter((report) => {
        try {
          const parsed: unknown = JSON.parse(report.uploadedReport);
          return this.isStoredReportReference(parsed)
            ? fileUrls.includes(parsed.fileUrl)
            : false;
        } catch {
          return fileUrls.includes(report.uploadedReport);
        }
      })
      .map((report) => report.id);

    if (matchingReportIds.length === 0) {
      return;
    }

    await this.reportsRepository.delete({
      id: In(matchingReportIds),
    });
  }

  private hasFileUrl(
    attachment: EventAttachment | null | undefined,
  ): attachment is EventAttachment {
    return Boolean(attachment?.fileUrl);
  }

  private isStoredReportReference(
    value: unknown,
  ): value is { fileUrl: string } {
    return (
      typeof value === 'object' &&
      value !== null &&
      typeof (value as Record<string, unknown>).fileUrl === 'string'
    );
  }
}
