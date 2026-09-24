import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, FindOptionsWhere, Repository } from 'typeorm';
import {
  FarmerProfile,
  FarmVerification,
  User,
  UserRole,
  VerificationStatus,
} from '../entities';
import { BaseCrudService } from '../common/base-crud.service';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { Paginated, PageQuery, resolvePage } from '../common/pagination';

export interface FarmVerificationsQuery extends PageQuery {
  farmerProfileId?: string;
  status?: VerificationStatus;
}

interface SubmittedPersonalDetails {
  fullName?: unknown;
  phoneNumber?: unknown;
}

interface SubmittedVerificationDocuments {
  personalDetails?: unknown;
  policySignerName?: unknown;
}

@Injectable()
export class FarmVerificationsService extends BaseCrudService<FarmVerification> {
  constructor(
    @InjectRepository(FarmVerification)
    repository: Repository<FarmVerification>,
    @InjectRepository(FarmerProfile)
    private readonly farmerProfileRepository: Repository<FarmerProfile>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    super(repository);
  }

  findByFarmerProfile(farmerProfileId: string): Promise<FarmVerification[]> {
    return this.repository.find({
      where: { farmerProfileId },
      order: { createdAt: 'DESC' },
    });
  }

  // Restricts a non-admin viewer to their own farmer profile's submissions —
  // admins can list everyone's, or one farmer's via farmerProfileId. The
  // status filter and pagination are applied on top of that scope, never in
  // place of it: a non-admin's farmerProfileId is always their own,
  // regardless of what (if anything) they pass in.
  async findAllForViewer(
    viewer: AuthenticatedUser,
    query: FarmVerificationsQuery,
  ): Promise<Paginated<FarmVerification>> {
    const { page, limit, skip, take } = resolvePage(query);
    const where: FindOptionsWhere<FarmVerification> = {};
    if (query.status) where.status = query.status;

    if (viewer.role === UserRole.ADMIN) {
      if (query.farmerProfileId) where.farmerProfileId = query.farmerProfileId;
    } else {
      const profile = await this.requireOwnProfile(viewer);
      where.farmerProfileId = profile.id;
    }

    const [data, total] = await this.repository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take,
    });
    return { data, total, page, limit };
  }

  // Fetches a submission and confirms `viewer` owns the farmer profile it
  // belongs to (or is an admin). Contains verification documents (IC,
  // selfie, certificates), so this is the one place a leak would be worst.
  async findOwned(
    id: string,
    viewer: AuthenticatedUser,
  ): Promise<FarmVerification> {
    const verification = await this.findOne(id);
    if (viewer.role === UserRole.ADMIN) return verification;
    const profile = await this.requireOwnProfile(viewer);
    if (verification.farmerProfileId !== profile.id) {
      throw new NotFoundException(`FarmVerification ${id} not found`);
    }
    return verification;
  }

  // Submitting a new attempt bumps the profile straight to PENDING so the
  // buyer-facing badge updates immediately, ahead of admin review.
  async submitForViewer(
    viewer: AuthenticatedUser,
    data: DeepPartial<FarmVerification>,
  ): Promise<FarmVerification> {
    const profile = await this.requireOwnProfile(viewer);
    const verification = await this.create({
      ...data,
      farmerProfileId: profile.id,
      status: VerificationStatus.PENDING,
      submittedAt: new Date(),
    });
    await this.farmerProfileRepository.update(profile.id, {
      verificationStatus: VerificationStatus.PENDING,
    });
    await this.syncRegisteredContact(profile.userId, data.documents);
    return verification;
  }

  private async syncRegisteredContact(
    userId: string,
    documents?: unknown,
  ): Promise<void> {
    const submittedDocuments =
      documents && typeof documents === 'object'
        ? (documents as SubmittedVerificationDocuments)
        : {};
    const personalDetails =
      submittedDocuments.personalDetails &&
      typeof submittedDocuments.personalDetails === 'object'
        ? (submittedDocuments.personalDetails as SubmittedPersonalDetails)
        : {};
    const submittedName =
      personalDetails.fullName ?? submittedDocuments.policySignerName;
    const submittedPhone = personalDetails.phoneNumber;
    const fullName =
      typeof submittedName === 'string'
        ? submittedName.trim().slice(0, 150)
        : '';
    const phone =
      typeof submittedPhone === 'string'
        ? submittedPhone.trim().slice(0, 30)
        : '';
    const update: Partial<Pick<User, 'fullName' | 'phone'>> = {};
    if (fullName) update.fullName = fullName;
    if (phone) update.phone = phone;
    if (Object.keys(update).length)
      await this.userRepository.update(userId, update);
  }

  // The current state lives on farmerProfile.verificationStatus; this row is
  // just the audit trail of the attempt, so review must keep both in sync.
  async review(
    id: string,
    input: { approve: boolean; reviewerId: string; rejectionReason?: string },
  ): Promise<FarmVerification> {
    const verification = await this.findOne(id);
    const status = input.approve
      ? VerificationStatus.VERIFIED
      : VerificationStatus.REJECTED;

    verification.status = status;
    verification.reviewedByUserId = input.reviewerId;
    verification.reviewedAt = new Date();
    verification.rejectionReason = input.approve
      ? null
      : (input.rejectionReason ?? null);
    await this.repository.save(verification);

    const profile = await this.farmerProfileRepository.findOne({
      where: { id: verification.farmerProfileId },
    });
    if (!profile) {
      throw new NotFoundException(
        `FarmerProfile ${verification.farmerProfileId} not found`,
      );
    }
    profile.verificationStatus = status;
    await this.farmerProfileRepository.save(profile);

    return verification;
  }

  private async requireOwnProfile(
    viewer: AuthenticatedUser,
  ): Promise<FarmerProfile> {
    const profile = await this.farmerProfileRepository.findOne({
      where: { userId: viewer.id },
    });
    if (!profile) {
      throw new NotFoundException('You do not have a farmer profile');
    }
    return profile;
  }
}
