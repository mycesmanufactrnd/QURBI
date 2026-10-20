import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { DataSource, FindOptionsWhere, Like, Repository } from 'typeorm';
import {
  CourierAuditLog,
  CourierProfile,
  CourierVerification,
  CourierVerificationStatus,
  NotificationAudience,
  NotificationType,
  RequestStatus,
  User,
  UserRole,
} from '../entities';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { Paginated, PageQuery, resolvePage } from '../common/pagination';
import { notify, notifyAdmins } from './notify';
import {
  RegisterCourierDto,
  ReviewRateDto,
  SubmitCourierVerificationDto,
  UpdateCourierProfileDto,
} from './dto/courier.dto';

// Recorded on the user row when a courier ticks the terms box at signup.
export const COURIER_AGREEMENTS_VERSION = 'courier-2026-10';

const REQUIRED_DOCUMENTS = ['icFront', 'icBack', 'selfie', 'licence'] as const;
const PRIVATE_UPLOAD_PATTERN = /^\/uploads\/private\/[0-9a-f-]{36}$/i;

export interface AdminCouriersQuery extends PageQuery {
  status?: CourierVerificationStatus;
  rateStatus?: RequestStatus;
  search?: string;
}

@Injectable()
export class CouriersService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(CourierProfile)
    private readonly profiles: Repository<CourierProfile>,
    @InjectRepository(CourierVerification)
    private readonly verifications: Repository<CourierVerification>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  // Creates the account and the profile together. Couriers are single-role
  // accounts: an email already used by a buyer or farmer cannot also become a
  // courier (their documents and approval must belong to one identity).
  async register(dto: RegisterCourierDto): Promise<{ id: string }> {
    const email = dto.email.toLowerCase();
    if (await this.users.findOne({ where: { email } })) {
      throw new ConflictException('Email is already registered');
    }
    const icNumber = dto.icNumber.replace(/[\s-]/g, '').toUpperCase();
    const duplicateIc = await this.profiles
      .createQueryBuilder('p')
      .where('p.icNumber = :icNumber', { icNumber })
      .getCount();
    if (duplicateIc) {
      throw new ConflictException(
        'A courier account already exists for this ID number',
      );
    }

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });
    const acceptedAt = new Date();

    return this.dataSource.transaction(async (manager) => {
      const user = await manager.save(
        manager.create(User, {
          email,
          passwordHash,
          fullName: dto.fullName.trim(),
          phone: dto.phone.trim(),
          role: UserRole.COURIER,
          privacyPolicyAcceptedAt: acceptedAt,
          userAgreementAcceptedAt: acceptedAt,
          adultConfirmedAt: acceptedAt,
          agreementsVersion: COURIER_AGREEMENTS_VERSION,
        }),
      );
      await manager.save(
        manager.create(CourierProfile, {
          userId: user.id,
          icNumber,
          vehicleType: dto.vehicleType,
          vehiclePlate: dto.vehiclePlate.replace(/\s+/g, '').toUpperCase(),
          serviceAreas: dto.serviceAreas,
          bankName: dto.bankName?.trim() || null,
          bankAccountNo: dto.bankAccountNo?.trim() || null,
          bankAccountHolder: dto.bankAccountHolder?.trim() || null,
        }),
      );
      return { id: user.id };
    });
  }

  async getOwnProfile(user: AuthenticatedUser) {
    const profile = await this.requireProfile(user.id);
    const latest = await this.verifications.findOne({
      where: { courierProfileId: profile.id },
      order: { createdAt: 'DESC' },
    });
    const owner = await this.users.findOne({ where: { id: user.id } });
    return {
      ...profile,
      user: owner
        ? { id: owner.id, fullName: owner.fullName, email: owner.email, phone: owner.phone }
        : null,
      latestVerification: latest,
    };
  }

  // Allowed in every state except SUSPENDED, so a rejected courier can
  // resubmit and an unverified one can submit for the first time.
  async submitVerification(
    user: AuthenticatedUser,
    dto: SubmitCourierVerificationDto,
  ): Promise<CourierVerification> {
    const profile = await this.requireProfile(user.id);
    if (
      profile.verificationStatus === CourierVerificationStatus.PENDING ||
      profile.verificationStatus === CourierVerificationStatus.APPROVED ||
      profile.verificationStatus === CourierVerificationStatus.SUSPENDED
    ) {
      throw new ConflictException(
        `Verification cannot be submitted while ${profile.verificationStatus}`,
      );
    }
    for (const key of REQUIRED_DOCUMENTS) {
      const value = dto.documents[key];
      if (typeof value !== 'string' || !PRIVATE_UPLOAD_PATTERN.test(value)) {
        throw new BadRequestException(
          `Document "${key}" is required and must be an uploaded private file`,
        );
      }
    }

    return this.dataSource.transaction(async (manager) => {
      const documents: Record<string, string> = {};
      for (const key of REQUIRED_DOCUMENTS) documents[key] = dto.documents[key];
      const verification = await manager.save(
        manager.create(CourierVerification, {
          courierProfileId: profile.id,
          status: CourierVerificationStatus.PENDING,
          documents,
          signatureUrl: dto.signatureUrl ?? null,
          submittedAt: new Date(),
        }),
      );
      await manager.update(CourierProfile, profile.id, {
        verificationStatus: CourierVerificationStatus.PENDING,
      });
      const owner = await manager.findOneOrFail(User, {
        where: { id: user.id },
      });
      await notifyAdmins(manager, {
        type: NotificationType.VERIFICATION,
        title: 'Courier awaiting approval',
        body: `${owner.fullName} submitted courier documents for review.`,
        linkUrl: `/admin/couriers/${profile.id}`,
        relatedType: 'courier_verification',
        relatedId: verification.id,
      });
      return verification;
    });
  }

  async updateProfile(
    user: AuthenticatedUser,
    dto: UpdateCourierProfileDto,
  ): Promise<CourierProfile> {
    const profile = await this.requireProfile(user.id);
    if (dto.vehicleType) profile.vehicleType = dto.vehicleType;
    if (dto.vehiclePlate) {
      profile.vehiclePlate = dto.vehiclePlate.replace(/\s+/g, '').toUpperCase();
    }
    if (dto.serviceAreas) profile.serviceAreas = dto.serviceAreas;
    if (dto.bankName !== undefined) profile.bankName = dto.bankName.trim();
    if (dto.bankAccountNo !== undefined) {
      profile.bankAccountNo = dto.bankAccountNo.trim();
    }
    if (dto.bankAccountHolder !== undefined) {
      profile.bankAccountHolder = dto.bankAccountHolder.trim();
    }
    return this.profiles.save(profile);
  }

  async setOnline(profile: CourierProfile, online: boolean) {
    profile.isOnline = online;
    await this.profiles.save(profile);
    return { isOnline: profile.isOnline };
  }

  // The courier proposes the flat fee they want per delivery. Nothing changes
  // for jobs until an admin approves; the previously approved fee stays in
  // force meanwhile.
  async proposeRate(profile: CourierProfile, fee: number) {
    profile.proposedFee = fee.toFixed(2);
    profile.rateStatus = RequestStatus.PENDING;
    profile.rateRejectionReason = null;
    await this.profiles.save(profile);
    await this.dataSource.transaction((manager) =>
      notifyAdmins(manager, {
        type: NotificationType.REQUEST_UPDATE,
        title: 'Courier rate awaiting approval',
        body: `A courier proposed RM ${profile.proposedFee} per delivery.`,
        linkUrl: `/admin/couriers/${profile.id}`,
        relatedType: 'courier_profile',
        relatedId: profile.id,
      }),
    );
    return profile;
  }

  // ---- admin ---------------------------------------------------------

  async findAllForAdmin(
    query: AdminCouriersQuery,
  ): Promise<Paginated<CourierProfile>> {
    const { page, limit, skip, take } = resolvePage(query);
    const where: FindOptionsWhere<CourierProfile> = {};
    if (query.status) where.verificationStatus = query.status;
    if (query.rateStatus) where.rateStatus = query.rateStatus;
    const search = query.search?.trim();
    const [data, total] = await this.profiles.findAndCount({
      where: search
        ? [
            { ...where, user: { fullName: Like(`%${search}%`) } },
            { ...where, user: { email: Like(`%${search}%`) } },
            { ...where, vehiclePlate: Like(`%${search.toUpperCase()}%`) },
          ]
        : where,
      relations: { user: true },
      order: { createdAt: 'DESC' },
      skip,
      take,
    });
    return { data, total, page, limit };
  }

  async findOneForAdmin(id: string) {
    const profile = await this.profiles.findOne({
      where: { id },
      relations: { user: true },
    });
    if (!profile) throw new NotFoundException(`Courier ${id} not found`);
    const verifications = await this.verifications.find({
      where: { courierProfileId: id },
      order: { createdAt: 'DESC' },
    });
    const audit = await this.dataSource.getRepository(CourierAuditLog).find({
      where: { courierProfileId: id },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    return { ...profile, verifications, audit };
  }

  async reviewVerification(
    id: string,
    reviewerId: string,
    input: { approve: boolean; rejectionReason?: string },
  ): Promise<CourierVerification> {
    if (!input.approve && !input.rejectionReason?.trim()) {
      throw new BadRequestException('A rejection reason is required');
    }
    return this.dataSource.transaction(async (manager) => {
      const verification = await manager.findOne(CourierVerification, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!verification) {
        throw new NotFoundException(`CourierVerification ${id} not found`);
      }
      if (verification.status !== CourierVerificationStatus.PENDING) {
        throw new ConflictException('This submission was already reviewed');
      }
      const profile = await manager.findOneOrFail(CourierProfile, {
        where: { id: verification.courierProfileId },
      });
      const status = input.approve
        ? CourierVerificationStatus.APPROVED
        : CourierVerificationStatus.REJECTED;

      verification.status = status;
      verification.reviewedByUserId = reviewerId;
      verification.reviewedAt = new Date();
      verification.rejectionReason = input.approve
        ? null
        : input.rejectionReason!.trim();
      await manager.save(verification);

      profile.verificationStatus = status;
      profile.suspensionReason = null;
      await manager.save(profile);

      await manager.save(
        manager.create(CourierAuditLog, {
          actorUserId: reviewerId,
          courierProfileId: profile.id,
          action: input.approve ? 'verification_approved' : 'verification_rejected',
          detail: { verificationId: id, reason: verification.rejectionReason },
        }),
      );
      await notify(manager, {
        userId: profile.userId,
        audience: NotificationAudience.COURIER,
        type: NotificationType.VERIFICATION,
        title: input.approve
          ? 'Courier account approved'
          : 'Courier verification rejected',
        body: input.approve
          ? 'You can now go online and accept delivery jobs.'
          : `Reason: ${verification.rejectionReason}. You can resubmit your documents.`,
        linkUrl: '/',
        relatedType: 'courier_verification',
        relatedId: id,
      });
      return verification;
    });
  }

  async suspend(id: string, adminId: string, reason: string) {
    return this.changeStanding(
      id,
      adminId,
      CourierVerificationStatus.SUSPENDED,
      reason,
    );
  }

  async reactivate(id: string, adminId: string) {
    return this.changeStanding(id, adminId, CourierVerificationStatus.APPROVED);
  }

  private async changeStanding(
    id: string,
    adminId: string,
    to: CourierVerificationStatus.SUSPENDED | CourierVerificationStatus.APPROVED,
    reason?: string,
  ): Promise<CourierProfile> {
    return this.dataSource.transaction(async (manager) => {
      const profile = await manager.findOne(CourierProfile, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!profile) throw new NotFoundException(`Courier ${id} not found`);
      if (to === CourierVerificationStatus.SUSPENDED) {
        if (profile.verificationStatus !== CourierVerificationStatus.APPROVED) {
          throw new ConflictException('Only approved couriers can be suspended');
        }
        profile.verificationStatus = CourierVerificationStatus.SUSPENDED;
        profile.suspensionReason = reason ?? null;
        profile.isOnline = false;
      } else {
        if (profile.verificationStatus !== CourierVerificationStatus.SUSPENDED) {
          throw new ConflictException('Only suspended couriers can be reactivated');
        }
        profile.verificationStatus = CourierVerificationStatus.APPROVED;
        profile.suspensionReason = null;
      }
      await manager.save(profile);
      await manager.save(
        manager.create(CourierAuditLog, {
          actorUserId: adminId,
          courierProfileId: id,
          action:
            to === CourierVerificationStatus.SUSPENDED
              ? 'suspended'
              : 'reactivated',
          detail: reason ? { reason } : null,
        }),
      );
      await notify(manager, {
        userId: profile.userId,
        audience: NotificationAudience.COURIER,
        type: NotificationType.VERIFICATION,
        title:
          to === CourierVerificationStatus.SUSPENDED
            ? 'Courier account suspended'
            : 'Courier account reactivated',
        body:
          to === CourierVerificationStatus.SUSPENDED
            ? `Reason: ${reason}. Contact support if you think this is a mistake.`
            : 'You can go online and accept jobs again.',
        linkUrl: '/',
        relatedType: 'courier_profile',
        relatedId: id,
      });
      return profile;
    });
  }

  async reviewRate(id: string, adminId: string, dto: ReviewRateDto) {
    return this.dataSource.transaction(async (manager) => {
      const profile = await manager.findOne(CourierProfile, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!profile) throw new NotFoundException(`Courier ${id} not found`);
      if (profile.rateStatus !== RequestStatus.PENDING || !profile.proposedFee) {
        throw new ConflictException('There is no pending rate to review');
      }
      if (!dto.approve && !dto.reason?.trim()) {
        throw new BadRequestException('A reason is required to reject a rate');
      }
      if (dto.approve) {
        profile.approvedFee = (dto.approvedFee ?? Number(profile.proposedFee)).toFixed(2);
        profile.rateStatus = RequestStatus.APPROVED;
        profile.rateRejectionReason = null;
      } else {
        profile.rateStatus = RequestStatus.REJECTED;
        profile.rateRejectionReason = dto.reason!.trim();
      }
      profile.rateReviewedByUserId = adminId;
      profile.rateReviewedAt = new Date();
      await manager.save(profile);
      await manager.save(
        manager.create(CourierAuditLog, {
          actorUserId: adminId,
          courierProfileId: id,
          action: dto.approve ? 'rate_approved' : 'rate_rejected',
          detail: {
            proposedFee: profile.proposedFee,
            approvedFee: profile.approvedFee,
            reason: dto.reason ?? null,
          },
        }),
      );
      await notify(manager, {
        userId: profile.userId,
        audience: NotificationAudience.COURIER,
        type: NotificationType.REQUEST_UPDATE,
        title: dto.approve ? 'Delivery rate approved' : 'Delivery rate rejected',
        body: dto.approve
          ? `Your rate of RM ${profile.approvedFee} per delivery is now active.`
          : `Reason: ${profile.rateRejectionReason}. Your previous rate stays in force.`,
        linkUrl: '/earnings',
        relatedType: 'courier_profile',
        relatedId: id,
      });
      return profile;
    });
  }

  private async requireProfile(userId: string): Promise<CourierProfile> {
    const profile = await this.profiles.findOne({ where: { userId } });
    if (!profile) throw new NotFoundException('You do not have a courier profile');
    return profile;
  }
}
