import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CourierProfile,
  CourierVerificationStatus,
  UserRole,
} from '../entities';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

export interface CourierRequest {
  user?: AuthenticatedUser;
  courierProfile?: CourierProfile;
}

// Route-scoped (pair with JwtAuthGuard's global instance, like RolesGuard).
// The approval check lives here, on the server, on every request — hiding the
// screens in the app is a convenience, not the control. A suspension takes
// effect on the very next call, without waiting for the access token to
// expire.
@Injectable()
export class ApprovedCourierGuard implements CanActivate {
  constructor(
    @InjectRepository(CourierProfile)
    private readonly profiles: Repository<CourierProfile>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<CourierRequest>();
    const user = request.user;
    if (!user || user.role !== UserRole.COURIER) {
      throw new ForbiddenException('Courier account required');
    }
    const profile = await this.profiles.findOne({
      where: { userId: user.id },
    });
    if (
      !profile ||
      profile.verificationStatus !== CourierVerificationStatus.APPROVED
    ) {
      throw new ForbiddenException(
        'Your courier account is not approved yet or has been suspended',
      );
    }
    request.courierProfile = profile;
    return true;
  }
}
