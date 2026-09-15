import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { User, RefreshToken, FarmerProfile } from '../entities';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  imports: [TypeOrmModule.forFeature([User, RefreshToken, FarmerProfile])],
  controllers: [AuthController],
  providers: [
    AuthService,
    // Global — default-deny for the whole app. @Public() is the only opt-out.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
