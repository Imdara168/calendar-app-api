import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateFolderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  folderName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  newFolderName: string;
}
