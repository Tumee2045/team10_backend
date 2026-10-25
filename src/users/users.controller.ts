import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { ResponseMessage } from '../common/http/response-message.decorator';
import { ImageFilesPipe } from '../common/pipes/image-files.pipe';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';
import { IdParam } from '../common/http/route.decorators';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  findMe(@CurrentUser() user: AuthUser) {
    return this.users.findMe(user.id);
  }

  @Patch('me')
  @ResponseMessage('Profile updated')
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.id, dto);
  }

  @Patch('me/password')
  @ResponseMessage('Password changed')
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.users.changePassword(user.id, dto);
  }

  @Post('me/avatar')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  @ResponseMessage('Avatar updated')
  uploadAvatar(
    @CurrentUser() user: AuthUser,
    @UploadedFile(ImageFilesPipe) file: Express.Multer.File,
  ) {
    return this.users.uploadAvatar(user.id, file);
  }

  @Public()
  @Get(':id')
  findPublicProfile(@IdParam() id: bigint) {
    return this.users.findPublicProfile(id);
  }
}
