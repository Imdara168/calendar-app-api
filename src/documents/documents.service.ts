import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { DocumentEntity } from './document.entity';
import { CreateDocumentDto } from './dto/create-document.dto';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { CalendarEventEntity } from '../events/calendar-event.entity';
import { ReportEntity } from '../reports/report.entity';
import { UserEntity } from '../users/user.entity';

type ParsedDocumentPayload = {
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
};

type StoredDocumentMetadata = {
  fileUrl: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
};

type StoredReportReference = {
  fileUrl: string;
};

type SyncDocumentInput = {
  userId: number;
  fileUrl: string;
  fileName: string;
  fileType?: string;
  fileSize?: number;
  date?: string | null;
  folderName?: string;
};

@Injectable()
export class DocumentsService implements OnModuleInit {
  constructor(
    @InjectRepository(DocumentEntity)
    private readonly documentsRepository: Repository<DocumentEntity>,
    @InjectRepository(CalendarEventEntity)
    private readonly eventsRepository: Repository<CalendarEventEntity>,
    @InjectRepository(ReportEntity)
    private readonly reportsRepository: Repository<ReportEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
  ) {}

  async onModuleInit() {
    await this.backfillMissingOwners();
  }

  async findAll(userId: number) {
    const documents = await this.documentsRepository.find({
      where: {
        user: { id: userId },
      },
      relations: {
        user: true,
      },
      order: {
        createdAt: 'DESC',
      },
    });

    const files = documents
      .filter((document) => !this.isFolderPlaceholder(document))
      .map((document) => this.serializeFile(document));

    return {
      folders: this.serializeFolders(documents),
      files,
    };
  }

  async create(userId: number, dto: CreateDocumentDto) {
    const fileUrl = dto.uploadedFile ?? dto.fileUrl;

    if (!fileUrl) {
      throw new BadRequestException('uploadedFile or fileUrl is required');
    }

    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const folderName = dto.folderName?.trim() ?? '';
    const fileName = dto.fileName.trim();

    const document = this.documentsRepository.create({
      user,
      folderName,
      fileName,
      uploadedFile: JSON.stringify({
        fileUrl,
        fileName,
        fileType: dto.fileType ?? this.detectFileType(fileUrl),
        fileSize: dto.fileSize ?? this.estimateFileSize(fileUrl),
      }),
      date: dto.date ?? null,
    });

    const saved = await this.documentsRepository.save(document);
    return this.serializeFile(saved);
  }

  async syncUploadedFile(input: SyncDocumentInput) {
    const fileUrl = input.fileUrl?.trim();

    if (!fileUrl) {
      throw new BadRequestException('fileUrl is required');
    }

    const fileName = input.fileName.trim();
    const folderName = input.folderName?.trim() ?? '';
    const user = await this.usersRepository.findOne({
      where: { id: input.userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const existingDocuments = await this.documentsRepository.find({
      where: {
        user: { id: input.userId },
      },
      relations: {
        user: true,
      },
    });
    const existingDocument = existingDocuments.find((document) => {
      if (this.isFolderPlaceholder(document)) {
        return false;
      }

      const payload = this.parseStoredDocument(
        document.uploadedFile,
        document.fileName,
      );
      return payload.fileUrl === fileUrl;
    });

    if (existingDocument) {
      const currentPayload = this.parseStoredDocument(
        existingDocument.uploadedFile,
        existingDocument.fileName,
      );

      existingDocument.fileName = fileName || currentPayload.fileName;
      existingDocument.uploadedFile = JSON.stringify({
        fileUrl,
        fileName: fileName || currentPayload.fileName,
        fileType: input.fileType ?? currentPayload.fileType,
        fileSize: input.fileSize ?? currentPayload.fileSize,
      });
      if (input.date !== undefined) {
        existingDocument.date = input.date;
      }

      if (folderName) {
        existingDocument.folderName = folderName;
      }

      const saved = await this.documentsRepository.save(existingDocument);
      return this.serializeFile(saved);
    }

    const document = this.documentsRepository.create({
      user,
      folderName,
      fileName,
      uploadedFile: JSON.stringify({
        fileUrl,
        fileName,
        fileType: input.fileType ?? this.detectFileType(fileUrl),
        fileSize: input.fileSize ?? this.estimateFileSize(fileUrl),
      }),
      date: input.date ?? null,
    });

    const saved = await this.documentsRepository.save(document);
    return this.serializeFile(saved);
  }

  async createFolder(_userId: number, dto: CreateFolderDto) {
    const user = await this.usersRepository.findOne({ where: { id: _userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const folderName = dto.folderName.trim();

    const existingDocuments = await this.documentsRepository.find({
      where: {
        folderName,
        user: { id: _userId },
      },
      relations: {
        user: true,
      },
      order: { createdAt: 'ASC' },
    });

    const existingPlaceholder = existingDocuments.find((document) =>
      this.isFolderPlaceholder(document),
    );

    let folderDocuments = existingDocuments;

    if (!existingPlaceholder) {
      const placeholder = this.documentsRepository.create({
        user,
        folderName,
        fileName: '',
        uploadedFile: '',
        date: null,
      });

      const savedPlaceholder = await this.documentsRepository.save(placeholder);
      folderDocuments = [...existingDocuments, savedPlaceholder];
    }

    if (folderDocuments.length === 0) {
      folderDocuments = await this.documentsRepository.find({
        where: {
          folderName,
          user: { id: _userId },
        },
        relations: {
          user: true,
        },
        order: { createdAt: 'ASC' },
      });
    }

    return this.serializeFolder(folderName, folderDocuments);
  }

  async updateFolder(_userId: number, dto: UpdateFolderDto) {
    const folderName = dto.folderName.trim();
    const newFolderName = dto.newFolderName.trim();

    if (folderName === newFolderName) {
      const folderDocuments = await this.documentsRepository.find({
        where: {
          folderName,
          user: { id: _userId },
        },
        relations: {
          user: true,
        },
        order: { createdAt: 'ASC' },
      });

      if (folderDocuments.length === 0) {
        throw new NotFoundException('Folder not found');
      }

      return this.serializeFolder(folderName, folderDocuments);
    }

    const folderDocuments = await this.documentsRepository.find({
      where: {
        folderName,
        user: { id: _userId },
      },
      relations: {
        user: true,
      },
      order: { createdAt: 'ASC' },
    });

    if (folderDocuments.length === 0) {
      throw new NotFoundException('Folder not found');
    }

    for (const document of folderDocuments) {
      document.folderName = newFolderName;
    }

    await this.documentsRepository.save(folderDocuments);

    const updatedDocuments = await this.documentsRepository.find({
      where: {
        folderName: newFolderName,
        user: { id: _userId },
      },
      relations: {
        user: true,
      },
      order: { createdAt: 'ASC' },
    });

    return this.serializeFolder(newFolderName, updatedDocuments);
  }

  async update(_userId: number, id: number, dto: UpdateDocumentDto) {
    const document = await this.documentsRepository.findOne({
      where: {
        id,
        user: { id: _userId },
      },
      relations: {
        user: true,
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    document.folderName = dto.folderName?.trim() ?? '';

    const saved = await this.documentsRepository.save(document);
    return this.serializeFile(saved);
  }

  async removeFolder(_userId: number, folderName: string) {
    const normalizedFolderName = folderName?.trim();

    if (!normalizedFolderName) {
      throw new BadRequestException('folderName is required');
    }

    const folderDocuments = await this.documentsRepository.find({
      where: {
        folderName: normalizedFolderName,
        user: { id: _userId },
      },
    });

    if (folderDocuments.length === 0) {
      throw new NotFoundException('Folder not found');
    }

    const placeholderDocuments = folderDocuments.filter((document) =>
      this.isFolderPlaceholder(document),
    );
    const actualFiles = folderDocuments.filter(
      (document) => !this.isFolderPlaceholder(document),
    );

    if (actualFiles.length > 0) {
      for (const document of actualFiles) {
        document.folderName = '';
      }

      await this.documentsRepository.save(actualFiles);
    }

    if (placeholderDocuments.length > 0) {
      await this.documentsRepository.delete({
        id: In(placeholderDocuments.map((document) => document.id)),
      });
    }

    return { success: true };
  }

  async remove(_userId: number, id: number) {
    const document = await this.documentsRepository.findOne({
      where: {
        id,
        user: { id: _userId },
      },
      relations: {
        user: true,
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    await this.documentsRepository.delete(document.id);
    return { success: true };
  }

  async deleteUploadedFilesByUrls(userId: number, fileUrls: string[]) {
    const normalizedFileUrls = fileUrls
      .map((fileUrl) => fileUrl.trim())
      .filter(Boolean);

    if (normalizedFileUrls.length === 0) {
      return { success: true, deletedCount: 0 };
    }

    const documents = await this.documentsRepository.find({
      where: {
        user: { id: userId },
      },
      relations: {
        user: true,
      },
    });

    const matchingDocumentIds = documents
      .filter((document) => !this.isFolderPlaceholder(document))
      .filter((document) => {
        const payload = this.parseStoredDocument(
          document.uploadedFile,
          document.fileName,
        );
        return normalizedFileUrls.includes(payload.fileUrl);
      })
      .map((document) => document.id);

    if (matchingDocumentIds.length === 0) {
      return { success: true, deletedCount: 0 };
    }

    await this.documentsRepository.delete({
      id: In(matchingDocumentIds),
    });

    return { success: true, deletedCount: matchingDocumentIds.length };
  }

  private async backfillMissingOwners() {
    const orphanDocuments = await this.documentsRepository.find({
      where: { userLink: IsNull() },
    });

    if (orphanDocuments.length === 0) {
      return;
    }

    const events = await this.eventsRepository.find();
    const reports = await this.reportsRepository.find();
    const reportOwnerByFileUrl = new Map<string, number>();

    for (const report of reports) {
      if (!report.userLink) {
        continue;
      }

      const payload = this.parseStoredReport(report.uploadedReport);
      reportOwnerByFileUrl.set(payload.fileUrl, report.userLink);
    }

    const documentsToUpdate = orphanDocuments.filter((document) => {
      if (this.isFolderPlaceholder(document)) {
        return false;
      }

      const payload = this.parseStoredDocument(
        document.uploadedFile,
        document.fileName,
      );
      const matchingEvent = events.find((event) =>
        Array.isArray(event.attachments)
          ? event.attachments.some(
              (attachment) => attachment?.fileUrl === payload.fileUrl,
            )
          : false,
      );

      const ownerId =
        matchingEvent?.userLink ?? reportOwnerByFileUrl.get(payload.fileUrl);

      if (!ownerId) {
        return false;
      }

      document.userLink = ownerId;
      return true;
    });

    if (documentsToUpdate.length > 0) {
      await this.documentsRepository.save(documentsToUpdate);
    }
  }

  private serializeFolders(documents: DocumentEntity[]) {
    const documentsByFolder = new Map<string, DocumentEntity[]>();

    for (const document of documents) {
      const folderName = document.folderName?.trim();

      if (!folderName) {
        continue;
      }

      const currentDocuments = documentsByFolder.get(folderName) ?? [];
      currentDocuments.push(document);
      documentsByFolder.set(folderName, currentDocuments);
    }

    return Array.from(documentsByFolder.entries())
      .map(([folderName, folderDocuments]) =>
        this.serializeFolder(folderName, folderDocuments),
      )
      .sort((left, right) => left.title.localeCompare(right.title));
  }

  private serializeFolder(folderName: string, documents: DocumentEntity[]) {
    const actualFiles = documents.filter(
      (document) => !this.isFolderPlaceholder(document),
    );
    const createdAt = documents.reduce((earliest, current) => {
      if (!earliest) {
        return current.createdAt;
      }

      return current.createdAt < earliest ? current.createdAt : earliest;
    }, documents[0]?.createdAt);

    return {
      id: folderName,
      title: folderName,
      createdAt,
      fileCount: actualFiles.length,
    };
  }

  private serializeFile(document: DocumentEntity) {
    const payload = this.parseStoredDocument(
      document.uploadedFile,
      document.fileName,
    );

    return {
      id: document.id,
      name: payload.fileName,
      type: payload.fileType,
      size: payload.fileSize,
      url: payload.fileUrl,
      uploadedAt: document.createdAt,
      folderId: document.folderName?.trim() || undefined,
      date: document.date,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };
  }

  private parseStoredDocument(
    uploadedFile: string,
    fallbackFileName: string,
  ): ParsedDocumentPayload {
    try {
      const parsed: unknown = JSON.parse(uploadedFile);

      if (this.isStoredDocumentMetadata(parsed)) {
        return {
          fileUrl: parsed.fileUrl,
          fileName:
            typeof parsed.fileName === 'string' &&
            parsed.fileName.trim().length > 0
              ? parsed.fileName
              : fallbackFileName || 'uploaded-file',
          fileType:
            typeof parsed.fileType === 'string' &&
            parsed.fileType.trim().length > 0
              ? parsed.fileType
              : this.detectFileType(parsed.fileUrl),
          fileSize:
            typeof parsed.fileSize === 'number'
              ? parsed.fileSize
              : this.estimateFileSize(parsed.fileUrl),
        };
      }
    } catch {
      // Older rows may contain a raw data URL instead of JSON metadata.
    }

    return {
      fileUrl: uploadedFile,
      fileName: fallbackFileName || 'uploaded-file',
      fileType: this.detectFileType(uploadedFile),
      fileSize: this.estimateFileSize(uploadedFile),
    };
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

  private estimateFileSize(fileUrl: string) {
    if (!fileUrl.startsWith('data:')) {
      return 0;
    }

    const payload = fileUrl.split(',', 2)[1];
    if (!payload) {
      return 0;
    }

    return Math.floor((payload.length * 3) / 4);
  }

  private isFolderPlaceholder(document: DocumentEntity) {
    return (
      document.fileName.trim() === '' && document.uploadedFile.trim() === ''
    );
  }

  private parseStoredReport(uploadedReport: string) {
    try {
      const parsed: unknown = JSON.parse(uploadedReport);

      if (this.isStoredReportReference(parsed)) {
        return {
          fileUrl: parsed.fileUrl,
        };
      }
    } catch {
      // Legacy report rows may contain a raw file URL.
    }

    return {
      fileUrl: uploadedReport,
    };
  }

  private isStoredDocumentMetadata(
    value: unknown,
  ): value is StoredDocumentMetadata {
    return (
      this.isRecord(value) &&
      typeof value.fileUrl === 'string' &&
      (value.fileName === undefined || typeof value.fileName === 'string') &&
      (value.fileType === undefined || typeof value.fileType === 'string') &&
      (value.fileSize === undefined || typeof value.fileSize === 'number')
    );
  }

  private isStoredReportReference(
    value: unknown,
  ): value is StoredReportReference {
    return this.isRecord(value) && typeof value.fileUrl === 'string';
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
