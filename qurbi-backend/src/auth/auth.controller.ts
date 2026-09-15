import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { AuthenticatedUser } from './auth.types';
import { CurrentUser } from './current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() input: RegisterDto) {
    return this.authService.register(input);
  }

  @Public()
  @Post('login')
  login(@Body() input: LoginDto) {
    return this.authService.login(input);
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user.sub);
  }
}
