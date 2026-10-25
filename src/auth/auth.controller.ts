import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { ResponseMessage } from '../common/http/response-message.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Action } from '../common/http/route.decorators';

@ApiTags('auth')
@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Use case: Бүртгэл үүсгэх. Returns a token right away, so no separate login is needed. */
  @Post('register')
  @ResponseMessage('Registered successfully')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  @Action('Logged in successfully')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }
}
