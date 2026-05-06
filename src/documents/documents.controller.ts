import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthenticatedUser } from '../common/authenticated-user.interface';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CreateDocumentDto } from './dto/create-document.dto';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { DocumentsService } from './documents.service';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.documentsService.findAll(user.sub);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDocumentDto,
  ) {
    return this.documentsService.create(user.sub, dto);
  }

  @Post('folders')
  createFolder(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFolderDto,
  ) {
    return this.documentsService.createFolder(user.sub, dto);
  }

  @Patch('folders')
  updateFolder(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateFolderDto,
  ) {
    return this.documentsService.updateFolder(user.sub, dto);
  }

  @Delete('folders')
  removeFolder(
    @CurrentUser() user: AuthenticatedUser,
    @Query('folderName') folderName: string,
  ) {
    return this.documentsService.removeFolder(user.sub, folderName);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDocumentDto,
  ) {
    return this.documentsService.update(user.sub, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.documentsService.remove(user.sub, id);
  }
}
