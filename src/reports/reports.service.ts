import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { ReportEntity } from './report.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { CalendarEventEntity } from '../events/calendar-event.entity';
import { DocumentsService } from '../documents/documents.service';
import { UserEntity } from '../users/user.entity';

type ParsedReportPayload = {
  fileUrl: string;
  fileName: string;
  fileType: string;
};

type StoredReportMetadata = {
  fileUrl: string;
  fileName?: string;
  fileType?: string;
};

@Injectable()
export class ReportsService implements OnModuleInit {
  constructor(
    @InjectRepository(ReportEntity)
    private readonly reportsRepository: Repository<ReportEntity>,
    @InjectRepository(CalendarEventEntity)
    private readonly eventsRepository: Repository<CalendarEventEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    private readonly documentsService: DocumentsService,
  ) {}

  async onModuleInit() {
    await this.backfillMissingOwners();
  }

  async findAll(userId: number, date?: string) {
    const reports = await this.reportsRepository.find({
      where: {
        ...(date ? { date } : {}),
        user: { id: userId },
      },
      relations: {
        user: true,
      },
      order: {
        createdAt: 'DESC',
      },
    });

    return reports.map((report) => this.serializeReport(report));
  }

  async create(userId: number, dto: CreateReportDto) {
    const uploadedReport = dto.uploadedReport ?? dto.fileUrl;

    if (!uploadedReport) {
      throw new NotFoundException('uploaded_report is required');
    }

    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const report = this.reportsRepository.create({
      user,
      date: dto.date,
      uploadedReport: JSON.stringify({
        fileUrl: uploadedReport,
        fileName: dto.fileName ?? 'uploaded-file',
        fileType: dto.fileType ?? this.detectFileType(uploadedReport),
      }),
    });

    const saved = await this.reportsRepository.save(report);
    await this.documentsService.syncUploadedFile({
      userId,
      fileUrl: uploadedReport,
      fileName: dto.fileName ?? 'uploaded-file',
      fileType: dto.fileType ?? this.detectFileType(uploadedReport),
      date: dto.date ?? null,
    });
    return this.serializeReport(saved);
  }

  async remove(userId: number, reportId: number) {
    const report = await this.reportsRepository.findOne({
      where: {
        id: reportId,
        user: { id: userId },
      },
      relations: {
        user: true,
      },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const payload = this.parseStoredReport(report.uploadedReport);
    const fileUrl = payload.fileUrl;
    const reports = await this.reportsRepository.find({
      where: {
        user: { id: userId },
      },
      relations: {
        user: true,
      },
    });
    const matchingReports = reports.filter((entry) => {
      const reportPayload = this.parseStoredReport(entry.uploadedReport);
      return reportPayload.fileUrl === fileUrl;
    });

    if (matchingReports.length > 0) {
      await this.reportsRepository.delete({
        id: In(matchingReports.map((entry) => entry.id)),
      });
    }

    const events = await this.eventsRepository.find({
      where: {
        user: { id: userId },
      },
      relations: {
        user: true,
      },
    });
    for (const event of events) {
      const currentAttachments = Array.isArray(event.attachments)
        ? event.attachments
        : [];
      const nextAttachments = currentAttachments.filter(
        (attachment) => attachment?.fileUrl !== fileUrl,
      );

      if (nextAttachments.length !== currentAttachments.length) {
        event.attachments = nextAttachments;
        await this.eventsRepository.save(event);
      }
    }

    return { success: true, fileUrl };
  }

  private async backfillMissingOwners() {
    const orphanReports = await this.reportsRepository.find({
      where: { userLink: IsNull() },
    });

    if (orphanReports.length === 0) {
      return;
    }

    const events = await this.eventsRepository.find();
    const reportsToUpdate = orphanReports.filter((report) => {
      const payload = this.parseStoredReport(report.uploadedReport);
      const matchingEvent = events.find((event) =>
        Array.isArray(event.attachments)
          ? event.attachments.some(
              (attachment) => attachment?.fileUrl === payload.fileUrl,
            )
          : false,
      );

      if (!matchingEvent?.userLink) {
        return false;
      }

      report.userLink = matchingEvent.userLink;
      return true;
    });

    if (reportsToUpdate.length > 0) {
      await this.reportsRepository.save(reportsToUpdate);
    }
  }

  private serializeReport(report: ReportEntity) {
    const payload = this.parseStoredReport(report.uploadedReport);

    return {
      id: report.id,
      date: report.date,
      uploadedReport: report.uploadedReport,
      fileUrl: payload.fileUrl,
      fileName: payload.fileName,
      fileType: payload.fileType,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    };
  }

  private parseStoredReport(uploadedReport: string): ParsedReportPayload {
    try {
      const parsed: unknown = JSON.parse(uploadedReport);

      if (this.isStoredReportMetadata(parsed)) {
        return {
          fileUrl: parsed.fileUrl,
          fileName:
            typeof parsed.fileName === 'string' &&
            parsed.fileName.trim().length > 0
              ? parsed.fileName
              : 'uploaded-file',
          fileType:
            typeof parsed.fileType === 'string' &&
            parsed.fileType.trim().length > 0
              ? parsed.fileType
              : this.detectFileType(parsed.fileUrl),
        };
      }
    } catch {
      // Older rows were stored as raw data URLs; keep supporting them.
    }

    return {
      fileUrl: uploadedReport,
      fileName: 'uploaded-file',
      fileType: this.detectFileType(uploadedReport),
    };
  }

  private isStoredReportMetadata(
    value: unknown,
  ): value is StoredReportMetadata {
    return (
      this.isRecord(value) &&
      typeof value.fileUrl === 'string' &&
      (value.fileName === undefined || typeof value.fileName === 'string') &&
      (value.fileType === undefined || typeof value.fileType === 'string')
    );
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private detectFileType(fileUrl: string) {
    if (fileUrl.startsWith('data:')) {
      const separatorIndex = fileUrl.indexOf(';');
      if (separatorIndex > 5) {
        return fileUrl.slice(5, separatorIndex);
      }
    }

    return 'application/octet-stream';
  }
}
