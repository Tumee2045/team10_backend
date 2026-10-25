import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'bat@example.com' })
  @Transform(({ value }: { value: string }) => value?.trim().toLowerCase())
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ minLength: 8, example: 'secret123' })
  @IsString()
  @Length(8, 72) // bcrypt only uses the first 72 bytes
  password!: string;

  @ApiProperty({ example: 'Бат Болд' })
  @Transform(({ value }: { value: string }) => value?.trim())
  @IsString()
  @Length(2, 100)
  fullName!: string;

  @ApiPropertyOptional({ example: '99112233' })
  @IsOptional()
  @Matches(/^\+?[0-9]{8,15}$/, { message: 'phone must be 8–15 digits' })
  phone?: string;
}
