import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { FarmerProfile, FarmVerification, VerificationStatus } from '../entities';
import { BaseCrudService } from '../common/base-crud.service';

@Injectable()
export class FarmVerificationsService extends BaseCrudService<FarmVerification> {
  constructor(
    @InjectRepository(FarmVerification) repository: Repository<FarmVerification>,
    @InjectRepository(FarmerProfile)
    private readonly farmerProfileRepository: Repository<FarmerProfile>,
  ) {
    super(repository);
  }

  findByFarmerProfile(farmerProfileId: string): Promise<FarmVerification[]> {
    return this.repository.find({
      where: { farmerProfileId },
      order: { createdAt: 'DESC' },
    });
  }

  // Submitting a new attempt bumps the profile straight to PENDING so the
  // buyer-facing badge updates immediately, ahead of admin review.
  async submit(data: DeepPartial<FarmVerification>): Promise<FarmVerification> {
    const verification = await this.create({
      ...data,
      status: VerificationStatus.PENDING,
      submittedAt: new Date(),
    });
    await this.farmerProfileRepository.update(verification.farmerProfileId, {
      verificationStatus: VerificationStatus.PENDING,
    });
    return verification;
  }

  // The current state lives on farmerProfile.verificationStatus; this row is
  // just the audit trail of the attempt, so review must keep both in sync.
  async review(
    id: string,
    input: { approve: boolean; reviewedByUserId: string; rejectionReason?: string },
  ): Promise<FarmVerification> {
    const verification = await this.findOne(id);
    const status = input.approve ? VerificationStatus.VERIFIED : VerificationStatus.REJECTED;

    verification.status = status;
    verification.reviewedByUserId = input.reviewedByUserId;
    verification.reviewedAt = new Date();
    verification.rejectionReason = input.approve ? null : (input.rejectionReason ?? null);
    await this.repository.save(verification);

    const profile = await this.farmerProfileRepository.findOne({
      where: { id: verification.farmerProfileId },
    });
    if (!profile) {
      throw new NotFoundException(`FarmerProfile ${verification.farmerProfileId} not found`);
    }
    profile.verificationStatus = status;
    await this.farmerProfileRepository.save(profile);

    return verification;
  }
}
