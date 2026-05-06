import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ReportsService } from './reports.service';
import { ReportEntity } from './report.entity';
import { CalendarEventEntity } from '../events/calendar-event.entity';
import { UserEntity } from '../users/user.entity';
import { DocumentsService } from '../documents/documents.service';

describe('ReportsService', () => {
  let service: ReportsService;

  const mockReportsRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    delete: jest.fn(),
    save: jest.fn(),
  };

  const mockEventsRepository = {
    find: jest.fn(),
    save: jest.fn(),
  };

  const mockUsersRepository = {
    findOne: jest.fn(),
  };

  const mockDocumentsService = {
    syncUploadedFile: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: getRepositoryToken(ReportEntity),
          useValue: mockReportsRepository,
        },
        {
          provide: getRepositoryToken(CalendarEventEntity),
          useValue: mockEventsRepository,
        },
        {
          provide: getRepositoryToken(UserEntity),
          useValue: mockUsersRepository,
        },
        {
          provide: DocumentsService,
          useValue: mockDocumentsService,
        },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  it('should delete matching report rows and unlink attachments from events', async () => {
    const report = {
      id: 10,
      uploadedReport: JSON.stringify({
        fileUrl: 'data:application/pdf;base64,abc',
        fileName: 'sample.pdf',
        fileType: 'application/pdf',
      }),
      user: { id: 1 },
    } as ReportEntity;

    const matchingReport = {
      id: 11,
      uploadedReport: JSON.stringify({
        fileUrl: 'data:application/pdf;base64,abc',
        fileName: 'sample.pdf',
        fileType: 'application/pdf',
      }),
      user: { id: 1 },
    } as ReportEntity;

    const event = {
      id: 5,
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

    mockReportsRepository.findOne.mockResolvedValue(report);
    mockReportsRepository.find.mockResolvedValue([report, matchingReport]);
    mockReportsRepository.delete.mockResolvedValue({ affected: 2 });
    mockEventsRepository.find.mockResolvedValue([event]);
    mockEventsRepository.save.mockResolvedValue({
      ...event,
      attachments: [],
    });

    await expect(service.remove(1, 10)).resolves.toEqual({
      success: true,
      fileUrl: 'data:application/pdf;base64,abc',
    });

    expect(mockReportsRepository.delete).toHaveBeenCalled();
    expect(mockEventsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 5,
        attachments: [],
      }),
    );
  });
});
