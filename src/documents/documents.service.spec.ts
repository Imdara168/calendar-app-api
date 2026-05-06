import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DocumentsService } from './documents.service';
import { DocumentEntity } from './document.entity';
import { CalendarEventEntity } from '../events/calendar-event.entity';
import { ReportEntity } from '../reports/report.entity';
import { UserEntity } from '../users/user.entity';
import { Repository } from 'typeorm';

describe('DocumentsService', () => {
  let service: DocumentsService;
  let documentsRepository: Repository<DocumentEntity>;
  let usersRepository: Repository<UserEntity>;

  const mockDocumentsRepository = {
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    findOne: jest.fn(),
  };

  const mockUsersRepository = {
    findOne: jest.fn(),
  };

  const mockEventsRepository = {
    find: jest.fn(),
  };

  const mockReportsRepository = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        {
          provide: getRepositoryToken(DocumentEntity),
          useValue: mockDocumentsRepository,
        },
        {
          provide: getRepositoryToken(CalendarEventEntity),
          useValue: mockEventsRepository,
        },
        {
          provide: getRepositoryToken(ReportEntity),
          useValue: mockReportsRepository,
        },
        {
          provide: getRepositoryToken(UserEntity),
          useValue: mockUsersRepository,
        },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
    documentsRepository = module.get<Repository<DocumentEntity>>(
      getRepositoryToken(DocumentEntity),
    );
    usersRepository = module.get<Repository<UserEntity>>(
      getRepositoryToken(UserEntity),
    );
  });

  it('should create a placeholder even if files already exist in the folder', async () => {
    const userId = 1;
    const folderName = 'Existing Folder';
    const user = { id: userId } as UserEntity;

    mockUsersRepository.findOne.mockResolvedValue(user);
    
    // Simulate folder having one file but no placeholder
    const existingFile = {
      id: 2,
      folderName,
      fileName: 'file.txt',
      uploadedFile: '{"fileUrl":"url"}',
    } as DocumentEntity;
    
    mockDocumentsRepository.find.mockResolvedValue([existingFile]);
    mockDocumentsRepository.create.mockReturnValue({
      user,
      folderName,
      fileName: '',
      uploadedFile: '',
      date: null,
    });

    await service.createFolder(userId, { folderName });

    // Expect create to have been called to create the placeholder
    expect(mockDocumentsRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      folderName,
      fileName: '',
      uploadedFile: '',
    }));
    expect(mockDocumentsRepository.save).toHaveBeenCalled();
  });
});
