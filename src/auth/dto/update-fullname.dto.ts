import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateFullnameDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fullname: string;
}
