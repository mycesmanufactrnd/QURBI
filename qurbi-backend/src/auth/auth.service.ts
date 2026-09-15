import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User, UserRole, UserStatus } from '../entities';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(input: RegisterDto) {
    const role =
      input.role === UserRole.FARMER ? UserRole.FARMER : UserRole.BUYER;
    const user = await this.usersService.create({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      fullName: input.fullName.trim(),
      phone: input.phone?.trim() || null,
      role,
      status: UserStatus.ACTIVE,
      emailVerified: false,
    });
    return this.session(user);
  }

  async login(input: LoginDto) {
    const user = await this.usersService.findByEmailWithPassword(
      input.email.trim().toLowerCase(),
    );
    if (
      !user ||
      !(await this.usersService.verifyPassword(user, input.password))
    ) {
      throw new UnauthorizedException('Email or password is incorrect');
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('This account is not active');
    }

    await this.usersService.recordLogin(user.id);
    const safeUser = await this.usersService.findOne(user.id);
    return this.session(safeUser);
  }

  me(userId: string) {
    return this.usersService.findOne(userId);
  }

  private async session(user: User) {
    return {
      accessToken: await this.jwtService.signAsync({
        sub: user.id,
        email: user.email,
        role: user.role,
      }),
      user,
    };
  }
}
