import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateFullnameDto } from './dto/update-fullname.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthenticatedUser } from '../common/authenticated-user.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('signup')
  signup(@Body() dto: RegisterDto) {
    return this.authService.signup(dto);
  }

  @Post('forget-password')
  forgetPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('change-password')
  changePassword(@Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(dto);
  }

  @Post('profile/change-password')
  @UseGuards(JwtAuthGuard)
  updatePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePasswordDto,
  ) {
    return this.authService.updatePassword(user.sub, dto);
  }

  @Post('profile/theme-color')
  @UseGuards(JwtAuthGuard)
  updateThemeColor(
    @CurrentUser() user: AuthenticatedUser,
    @Body('themeColor') themeColor: string,
  ) {
    return this.authService.updateThemeColor(user.sub, themeColor);
  }

  @Post('profile/fullname')
  @UseGuards(JwtAuthGuard)
  updateFullname(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateFullnameDto,
  ) {
    return this.authService.updateFullname(user.sub, dto.fullname);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getProfile(user.sub);
  }

  @Get('users')
  @UseGuards(JwtAuthGuard)
  getUsers() {
    return this.authService.getUsers();
  }
}
