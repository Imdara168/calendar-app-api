import {
  ConflictException,
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { UserEntity } from '../users/user.entity';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    private readonly jwtService: JwtService,
  ) {}

  async onModuleInit() {
    await this.ensureAdminUser();
  }

  async login(dto: LoginDto) {
    const username = dto.username.trim();
    const user = await this.usersRepository.findOne({ where: { username } });

    if (!user) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.password);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid username or password');
    }

    return this.buildAuthResponse(user);
  }

  async signup(dto: RegisterDto) {
    const username = dto.username.trim();
    const existingUser = await this.usersRepository.findOne({ where: { username } });

    if (existingUser) {
      throw new ConflictException('Username already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = this.usersRepository.create({
      username,
      password: hashedPassword,
      slug: this.generateEncryptedSlug(),
      fullname: dto.fullname.trim(),
    });

    const savedUser = await this.usersRepository.save(user);
    return this.buildAuthResponse(savedUser);
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const username = dto.username.trim();
    const user = await this.usersRepository.findOne({ where: { username } });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const resetToken = this.generateEncryptedSlug();
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpiresAt = new Date(Date.now() + 1000 * 60 * 15);
    await this.usersRepository.save(user);

    return {
      message: 'Password reset started',
      username: user.username,
      resetToken,
    };
  }

  async changePassword(dto: ChangePasswordDto) {
    const username = dto.username.trim();
    const user = await this.usersRepository.findOne({ where: { username } });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.resetPasswordToken || user.resetPasswordToken !== dto.resetToken) {
      throw new UnauthorizedException('Invalid reset token');
    }

    if (!user.resetPasswordExpiresAt || user.resetPasswordExpiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Reset token expired');
    }

    user.password = await bcrypt.hash(dto.newPassword, 10);
    user.resetPasswordToken = null;
    user.resetPasswordExpiresAt = null;
    await this.usersRepository.save(user);

    return {
      success: true,
      message: 'Password changed successfully',
    };
  }

  async updatePassword(userId: number, dto: UpdatePasswordDto) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const passwordMatches = await bcrypt.compare(
      dto.currentPassword,
      user.password,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const samePassword = await bcrypt.compare(dto.newPassword, user.password);

    if (samePassword) {
      throw new ConflictException(
        'New password must be different from the current password',
      );
    }

    user.password = await bcrypt.hash(dto.newPassword, 10);
    user.resetPasswordToken = null;
    user.resetPasswordExpiresAt = null;
    await this.usersRepository.save(user);

    return {
      success: true,
      message: 'Password changed successfully',
    };
  }

  async getProfile(userId: number) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.serializeUser(user);
  }

  async ensureAdminUser() {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const existingAdmin = await this.usersRepository.findOne({
      where: { username: 'admin' },
    });

    if (existingAdmin) {
      existingAdmin.password = hashedPassword;
      existingAdmin.resetPasswordToken = null;
      existingAdmin.resetPasswordExpiresAt = null;
      if (!existingAdmin.slug || existingAdmin.slug === 'admin') {
        existingAdmin.slug = this.generateEncryptedSlug();
      }
      existingAdmin.fullname = 'Administrator';
      await this.usersRepository.save(existingAdmin);
      return existingAdmin;
    }

    const adminUser = this.usersRepository.create({
      username: 'admin',
      password: hashedPassword,
      resetPasswordToken: null,
      resetPasswordExpiresAt: null,
      slug: this.generateEncryptedSlug(),
      fullname: 'Administrator',
    });

    return this.usersRepository.save(adminUser);
  }

  private async buildAuthResponse(user: UserEntity) {
    const token = await this.jwtService.signAsync({
      sub: user.id,
      username: user.username,
      slug: user.slug,
    });

    return {
      token,
      user: this.serializeUser(user),
    };
  }

  private serializeUser(user: UserEntity) {
    return {
      id: user.id,
      username: user.username,
      slug: user.slug,
      fullname: user.fullname,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private generateEncryptedSlug() {
    return randomBytes(24).toString('hex');
  }
}
