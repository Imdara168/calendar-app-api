import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventsService } from './events.service';
import { CalendarEventEntity } from './calendar-event.entity';
import { UserEntity } from '../users/user.entity';
import { ReportEntity } from '../reports/report.entity';
import { DocumentsService } from '../documents/documents.service';

describe('EventsService', () => {
  let service: EventsService;

  const mockEventsRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    delete: jest.fn(),
  };

  const mockUsersRepository = {
    findOne: jest.fn(),
  };

  const mockReportsRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  const mockDocumentsService = {
    syncUploadedFile: jest.fn(),
    deleteUploadedFilesByUrls: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        {
          provide: getRepositoryToken(CalendarEventEntity),
          useValue: mockEventsRepository,
        },
        {
          provide: getRepositoryToken(UserEntity),
          useValue: mockUsersRepository,
        },
        {
          provide: getRepositoryToken(ReportEntity),
          useValue: mockReportsRepository,
        },
        {
          provide: DocumentsService,
          useValue: mockDocumentsService,
        },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
  });

  it('should delete an owned event and clean up orphaned synced files', async () => {
    const event = {
      id: 7,
      user: { id: 1 },
      attachments: [
        {
          fileUrl: 'data:application/pdf;base64,abc',
          fileName: 'sample.pdf',
          fileType: 'application/pdf',
          fileSize: 123,
        },
      ],
    } as CalendarEventEntity;
    const matchingReport = {
      id: 4,
      uploadedReport: JSON.stringify({
        fileUrl: 'data:application/pdf;base64,abc',
        fileName: 'sample.pdf',
        fileType: 'application/pdf',
      }),
      user: { id: 1 },
    } as ReportEntity;

    mockEventsRepository.findOne.mockResolvedValue(event);
    mockEventsRepository.find.mockResolvedValue([event]);
    mockEventsRepository.delete.mockResolvedValue({ affected: 1 });
    mockReportsRepository.find.mockResolvedValue([matchingReport]);
    mockReportsRepository.delete.mockResolvedValue({ affected: 1 });
    mockDocumentsService.deleteUploadedFilesByUrls.mockResolvedValue({
      success: true,
      deletedCount: 1,
    });

    await expect(service.remove(1, 7)).resolves.toEqual({ success: true });

    expect(mockEventsRepository.delete).toHaveBeenCalledWith(7);
    expect(mockReportsRepository.delete).toHaveBeenCalled();
    expect(mockDocumentsService.deleteUploadedFilesByUrls).toHaveBeenCalledWith(
      1,
      ['data:application/pdf;base64,abc'],
    );
  });
});
