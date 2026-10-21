import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, DeepPartial, EntityManager, Repository } from 'typeorm';
import {
  Breed,
  FarmerProfile,
  Livestock,
  LivestockStatus,
  Notification,
  NotificationAudience,
  NotificationType,
  OrderItem,
  RequestStatus,
  Reservation,
  ReservationStatus,
  Species,
  User,
  UserRole,
  VerificationStatus,
} from '../entities';
import { BaseCrudService } from '../common/base-crud.service';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { Paginated, PageQuery, resolvePage } from '../common/pagination';
import { ReservationsService } from '../reservations/reservations.service';

export interface DerivedMarketplaceVisibility {
  marketplaceVisible: boolean;
  marketplaceVisibilityReason: string | null;
}

export type LivestockWithVisibility = Livestock & DerivedMarketplaceVisibility;

export const LISTING_LIFETIME_MS = 14 * 24 * 60 * 60 * 1000;
export const MARKETPLACE_COMPLIANCE_POLICY_VERSION = 'QURBI-MY-DVS-2026-01';

type MarketplaceCompliance = {
  policyVersion?: string;
  earTagId?: string;
  healthCertificateUrl?: string;
  vaccinationRecordUrl?: string;
  reviewStatus?: 'incomplete' | 'pending' | 'approved' | 'rejected';
  reviewNote?: string | null;
  requestedStatus?: LivestockStatus;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  assistance?: {
    requested?: boolean;
    status?: 'pending' | 'contacted' | 'completed' | 'cancelled';
    contactName?: string;
    phone?: string;
    identityOrCompanyNumber?: string;
    premiseId?: string;
    farmAddress?: string;
    state?: string;
    animalCount?: number;
    notes?: string;
    requestedAt?: string | null;
  };
};

export function marketplaceComplianceEvidenceComplete(
  compliance: MarketplaceCompliance | null | undefined,
): boolean {
  return Boolean(
    compliance?.earTagId?.trim() &&
    compliance.healthCertificateUrl?.trim() &&
    compliance.vaccinationRecordUrl?.trim(),
  );
}

// Marketplace policy, enforced by the API rather than trusted from clients.
export const MIN_MARKETPLACE_AGE_MONTHS: Readonly<Record<string, number>> = {
  Cow: 6,
  Goat: 4,
  Sheep: 3,
};

export interface LivestockQuery extends PageQuery {
  farmerId?: string;
  speciesId?: string;
  categoryId?: string;
  status?: LivestockStatus;
  adminBlocked?: boolean;
}

@Injectable()
export class LivestockService extends BaseCrudService<Livestock> {
  constructor(
    @InjectRepository(Livestock) repository: Repository<Livestock>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly reservationsService: ReservationsService,
  ) {
    super(repository);
  }

  // The public browse query: only listings that pass every marketplace
  // condition, UNLESS the viewer is an admin (sees everything) or a farmer
  // looking at their own inventory (query.farmerId === viewer.id — sees their
  // own listings regardless of visibility, e.g. still-pending ones).
  // adminBlocked/status/etc. are applied on top of that scope, never in
  // place of it — a non-admin can never use them to see past their own scope,
  // at worst they narrow it down to nothing (e.g. adminBlocked=true as a
  // buyer: blocked listings are never in the buyer-visible set anyway).
  async findAllForViewer(
    query: LivestockQuery,
    viewer?: AuthenticatedUser,
  ): Promise<Paginated<LivestockWithVisibility>> {
    await this.dataSource.transaction(async (manager) => {
      await this.reservationsService.expireDue(manager);
      await this.expireDueListings(manager);
    });
    const { page, limit, skip, take } = resolvePage(query);
    const isOwnInventory =
      viewer?.role === UserRole.FARMER && query.farmerId === viewer.id;
    const isAdmin = viewer?.role === UserRole.ADMIN;
    const showEverything = isAdmin || isOwnInventory;

    const qb = this.repository
      .createQueryBuilder('livestock')
      .leftJoinAndSelect('livestock.species', 'species')
      .leftJoinAndSelect('livestock.breed', 'breed')
      .leftJoinAndSelect('livestock.category', 'category')
      .innerJoinAndSelect('livestock.farmer', 'farmer')
      .innerJoinAndSelect('farmer.farmerProfile', 'farmerProfile')
      .orderBy('livestock.createdAt', 'DESC');

    if (query.farmerId)
      qb.andWhere('livestock.farmerId = :farmerId', {
        farmerId: query.farmerId,
      });
    if (query.speciesId)
      qb.andWhere('livestock.speciesId = :speciesId', {
        speciesId: query.speciesId,
      });
    if (query.categoryId)
      qb.andWhere('livestock.categoryId = :categoryId', {
        categoryId: query.categoryId,
      });
    if (query.status)
      qb.andWhere('livestock.status = :status', { status: query.status });
    if (query.adminBlocked !== undefined) {
      qb.andWhere('livestock.adminBlocked = :adminBlocked', {
        adminBlocked: query.adminBlocked,
      });
    }

    if (!showEverything) {
      qb.andWhere('livestock.status = :availableStatus', {
        availableStatus: LivestockStatus.AVAILABLE,
      })
        .andWhere('livestock.adminBlocked = false')
        .andWhere('farmerProfile.verificationStatus = :verified', {
          verified: VerificationStatus.VERIFIED,
        })
        .andWhere('livestock.speciesApprovalStatus = :approved', {
          approved: RequestStatus.APPROVED,
        })
        .andWhere(
          `NOT EXISTS (
            SELECT 1 FROM reservations activeReservation
            WHERE activeReservation.livestockId = livestock.id
              AND activeReservation.status = :activeReservationStatus
          )`,
          { activeReservationStatus: ReservationStatus.ACTIVE },
        )
        .andWhere('livestock.breedApprovalStatus = :approved', {
          approved: RequestStatus.APPROVED,
        })
        .andWhere(
          '(livestock.marketplaceEligibleFrom IS NULL OR livestock.marketplaceEligibleFrom <= :now)',
          {
            now: new Date(),
          },
        )
        .andWhere(
          'COALESCE(livestock.marketplaceExpiresAt, DATE_ADD(livestock.createdAt, INTERVAL 14 DAY)) > :now',
          { now: new Date() },
        );
    }

    const total = await qb.getCount();
    qb.skip(skip).take(take);
    const rows = await qb.getRawAndEntities();
    const data = rows.entities.map((listing, index) => {
      const raw = rows.raw[index] as {
        farmerProfile_verificationStatus: VerificationStatus;
      };
      const verificationStatus = raw.farmerProfile_verificationStatus;
      return this.withPublicFarmer(
        this.withDerivedVisibility(listing, verificationStatus),
      );
    });
    return { data, total, page, limit };
  }

  async findOneWithVisibility(id: string): Promise<LivestockWithVisibility> {
    const listing = await this.repository.findOne({
      where: { id },
      relations: {
        species: true,
        breed: true,
        category: true,
        farmer: { farmerProfile: true },
      },
    });
    if (!listing) throw new NotFoundException(`Livestock ${id} not found`);
    const verificationStatus =
      listing.farmer?.farmerProfile?.verificationStatus ??
      VerificationStatus.UNVERIFIED;
    return this.withPublicFarmer(
      this.withDerivedVisibility(listing, verificationStatus),
    );
  }

  private withPublicFarmer(
    listing: LivestockWithVisibility,
  ): LivestockWithVisibility {
    const farmer = listing.farmer;
    const profile = farmer?.farmerProfile;
    if (!farmer || !profile) return listing;

    listing.farmer = {
      id: farmer.id,
      fullName: farmer.fullName,
      avatarUrl: farmer.avatarUrl,
      farmerProfile: {
        id: profile.id,
        userId: profile.userId,
        farmName: profile.farmName,
        farmDescription: profile.farmDescription,
        farmAddressLine: profile.farmAddressLine,
        farmCity: profile.farmCity,
        farmState: profile.farmState,
        farmPostcode: profile.farmPostcode,
        logoUrl: profile.logoUrl,
        deliveryPreference: profile.deliveryPreference,
        verificationStatus: profile.verificationStatus,
        ratingAverage: profile.ratingAverage,
        ratingCount: profile.ratingCount,
        totalSales: profile.totalSales,
      } as FarmerProfile,
    } as User;
    return listing;
  }

  async findOneForViewer(
    id: string,
    viewer?: AuthenticatedUser,
  ): Promise<LivestockWithVisibility> {
    await this.dataSource.transaction((manager) =>
      this.reservationsService.expireDue(manager, id),
    );
    const listing = await this.findOneWithVisibility(id);
    const buyerOwnsOrderItem =
      viewer?.role === UserRole.BUYER &&
      (await this.dataSource
        .getRepository(OrderItem)
        .createQueryBuilder('orderItem')
        .innerJoin('orderItem.order', 'buyerOrder')
        .where('orderItem.livestockId = :id', { id })
        .andWhere('buyerOrder.buyerId = :buyerId', { buyerId: viewer.id })
        .getExists());
    const canSeeHidden =
      viewer?.role === UserRole.ADMIN ||
      (viewer?.role === UserRole.FARMER && listing.farmerId === viewer.id) ||
      (await this.isReservedBy(id, viewer)) ||
      buyerOwnsOrderItem;
    if (!canSeeHidden && !listing.marketplaceVisible) {
      throw new NotFoundException(`Livestock ${id} not found`);
    }
    if (!canSeeHidden) {
      await this.repository.increment({ id }, 'viewCount', 1);
      listing.viewCount += 1;
    }
    return listing;
  }

  // A buyer who reserved or bought this animal can still open it (to resume
  // payment or look back at an order) even though it has left the marketplace.
  private async isReservedBy(
    livestockId: string,
    viewer?: AuthenticatedUser,
  ): Promise<boolean> {
    if (viewer?.role !== UserRole.BUYER) return false;
    return this.dataSource.getRepository(Reservation).exists({
      where: [
        { livestockId, userId: viewer.id, status: ReservationStatus.ACTIVE },
        { livestockId, userId: viewer.id, status: ReservationStatus.COMPLETED },
      ],
    });
  }

  availability(id: string, viewer: AuthenticatedUser) {
    return this.reservationsService.availability(id, viewer.id);
  }

  // Computes the same visible/reason pair the browse query filters on, purely
  // from facts that live elsewhere (farmer verification, species/breed
  // approval, eligibility date) plus the one real stored fact, the admin
  // block — never stored itself, so it can never drift from those sources.
  private withDerivedVisibility(
    listing: Livestock,
    farmerVerificationStatus: VerificationStatus,
  ): LivestockWithVisibility {
    return Object.assign(
      listing,
      computeMarketplaceVisibility(listing, farmerVerificationStatus),
    );
  }

  async createForFarmer(
    farmerId: string,
    data: DeepPartial<Livestock>,
  ): Promise<Livestock> {
    if (!data.speciesId)
      throw new BadRequestException('Select an active species');
    if (
      data.status === LivestockStatus.RESERVED ||
      data.status === LivestockStatus.SOLD
    ) {
      throw new BadRequestException(
        'A new listing cannot start as reserved or sold',
      );
    }
    const species = await this.validateReferenceData(
      data.speciesId,
      data.breedId,
    );
    const attributes = data.attributes ?? {};
    const speciesPending = Boolean(attributes.speciesRequestId);
    const breedPending = Boolean(attributes.breedRequestId);
    const requestedStatus = data.status ?? LivestockStatus.DRAFT;
    const suppliedCompliance = (attributes.marketplaceCompliance ??
      {}) as MarketplaceCompliance;
    const evidenceComplete = marketplaceComplianceEvidenceComplete({
      ...suppliedCompliance,
      earTagId: data.tagNumber || suppliedCompliance.earTagId,
    });
    const assistanceRequested = Boolean(
      suppliedCompliance.assistance?.requested,
    );
    const marketplaceCompliance: MarketplaceCompliance = {
      ...suppliedCompliance,
      policyVersion: MARKETPLACE_COMPLIANCE_POLICY_VERSION,
      earTagId: data.tagNumber || suppliedCompliance.earTagId || '',
      reviewStatus: evidenceComplete ? 'pending' : 'incomplete',
      reviewNote: null,
      requestedStatus,
      submittedAt:
        evidenceComplete || assistanceRequested
          ? new Date().toISOString()
          : null,
      reviewedAt: null,
      assistance: {
        ...(suppliedCompliance.assistance ?? {}),
        requested: assistanceRequested,
        status: assistanceRequested ? 'pending' : undefined,
        requestedAt: assistanceRequested ? new Date().toISOString() : null,
      },
    };
    // Every listing created under the new compliance policy starts as a draft.
    // A client cannot self-approve by posting reviewStatus: "approved".
    const status = LivestockStatus.DRAFT;
    data.attributes = { ...attributes, marketplaceCompliance };
    this.normalizeAgeFields(data);
    this.requireAgeWhenPublishing(status, data.birthDate, data.ageMonths);
    const marketplaceEligibleFrom = computeMarketplaceEligibleFrom({
      speciesName: species.name,
      birthDate: data.birthDate,
      ageMonths: data.ageMonths,
      ageRecordedAt: this.ageRecordedAt(attributes),
    });
    const listing = await this.create({
      ...data,
      status,
      farmerId,
      marketplaceEligibleFrom,
      marketplaceExpiresAt: null,
      speciesApprovalStatus: speciesPending
        ? RequestStatus.PENDING
        : RequestStatus.APPROVED,
      breedApprovalStatus: breedPending
        ? RequestStatus.PENDING
        : RequestStatus.APPROVED,
    });
    await this.notifyAdminsOfComplianceSubmission(
      listing,
      evidenceComplete,
      assistanceRequested,
    );
    return listing;
  }

  async updateOwned(
    id: string,
    viewer: AuthenticatedUser,
    data: DeepPartial<Livestock>,
  ): Promise<Livestock> {
    const listing = await this.findOwned(id, viewer);

    if (listing.status === LivestockStatus.SOLD) {
      throw new ConflictException(
        'Sold livestock cannot be edited or republished because it belongs to a completed order',
      );
    }
    if (listing.status === LivestockStatus.RESERVED) {
      throw new ConflictException(
        'Reserved livestock cannot be edited while a buyer is completing payment',
      );
    }
    if (
      data.status === LivestockStatus.RESERVED ||
      data.status === LivestockStatus.SOLD
    ) {
      throw new BadRequestException(
        'RESERVED and SOLD statuses are managed by the payment system',
      );
    }
    let speciesApprovalStatus = listing.speciesApprovalStatus;
    let breedApprovalStatus = listing.breedApprovalStatus;
    let complianceSubmissionChanged = false;
    let assistanceRequestedNow = false;
    const attributes = data.attributes ?? {};
    const speciesId = data.speciesId ?? listing.speciesId;
    const breedId = data.breedId === undefined ? listing.breedId : data.breedId;
    const species = await this.validateReferenceData(speciesId, breedId);
    if (data.speciesId !== undefined || data.breedId !== undefined) {
      if (
        data.speciesId !== undefined &&
        data.speciesId !== listing.speciesId
      ) {
        speciesApprovalStatus = RequestStatus.APPROVED;
        data.speciesApprovalStatus = speciesApprovalStatus;
      }
      if (data.breedId && data.breedId !== listing.breedId) {
        breedApprovalStatus = RequestStatus.APPROVED;
        data.breedApprovalStatus = breedApprovalStatus;
      }
    }
    if (attributes.speciesRequestId) {
      speciesApprovalStatus = RequestStatus.PENDING;
      data.speciesApprovalStatus = speciesApprovalStatus;
    }
    if (attributes.breedRequestId) {
      breedApprovalStatus = RequestStatus.PENDING;
      data.breedApprovalStatus = breedApprovalStatus;
    }
    const effectiveAttributesBeforeUpdate = {
      ...(listing.attributes ?? {}),
      ...(data.attributes ?? {}),
    };
    const existingCompliance = listing.attributes?.marketplaceCompliance as
      MarketplaceCompliance | undefined;
    if (existingCompliance?.policyVersion) {
      const submittedCompliance =
        effectiveAttributesBeforeUpdate.marketplaceCompliance as
          MarketplaceCompliance | undefined;
      const evidenceChanged = Boolean(
        submittedCompliance &&
        (submittedCompliance.earTagId !== existingCompliance.earTagId ||
          submittedCompliance.healthCertificateUrl !==
            existingCompliance.healthCertificateUrl ||
          submittedCompliance.vaccinationRecordUrl !==
            existingCompliance.vaccinationRecordUrl),
      );
      const nextCompliance: MarketplaceCompliance = {
        ...existingCompliance,
        ...(submittedCompliance ?? {}),
        policyVersion: MARKETPLACE_COMPLIANCE_POLICY_VERSION,
        earTagId:
          (data.tagNumber as string | undefined) ??
          submittedCompliance?.earTagId ??
          existingCompliance.earTagId,
      };
      if (evidenceChanged) {
        complianceSubmissionChanged = true;
        nextCompliance.reviewStatus = marketplaceComplianceEvidenceComplete(
          nextCompliance,
        )
          ? 'pending'
          : 'incomplete';
        nextCompliance.reviewNote = null;
        nextCompliance.reviewedAt = null;
        nextCompliance.submittedAt = new Date().toISOString();
      } else {
        // Farmers cannot alter an admin decision through the generic endpoint.
        nextCompliance.reviewStatus = existingCompliance.reviewStatus;
        nextCompliance.reviewNote = existingCompliance.reviewNote;
        nextCompliance.reviewedAt = existingCompliance.reviewedAt;
      }
      assistanceRequestedNow = Boolean(
        nextCompliance.assistance?.requested &&
        !existingCompliance.assistance?.requested,
      );
      effectiveAttributesBeforeUpdate.marketplaceCompliance = nextCompliance;
      data.attributes = effectiveAttributesBeforeUpdate;
      if (
        data.status === LivestockStatus.AVAILABLE &&
        nextCompliance.reviewStatus !== 'approved'
      ) {
        data.status = LivestockStatus.DRAFT;
      }
    }
    if (data.status === LivestockStatus.AVAILABLE) {
      if (speciesApprovalStatus !== RequestStatus.APPROVED) {
        throw new ConflictException(
          'This livestock cannot be published until its species is approved',
        );
      }
      if (breedApprovalStatus !== RequestStatus.APPROVED) {
        throw new ConflictException(
          'This livestock cannot be published until an approved breed is selected',
        );
      }
      data.soldAt = null;
    }
    this.normalizeAgeFields(data);
    const effectiveBirthDate =
      data.birthDate !== undefined ? data.birthDate : listing.birthDate;
    const effectiveAgeMonths =
      data.ageMonths !== undefined ? data.ageMonths : listing.ageMonths;
    const effectiveStatus = data.status ?? listing.status;
    this.requireAgeWhenPublishing(
      effectiveStatus,
      effectiveBirthDate,
      effectiveAgeMonths,
    );
    const effectiveAttributes = {
      ...(listing.attributes ?? {}),
      ...(data.attributes ?? {}),
    };
    data.marketplaceEligibleFrom = computeMarketplaceEligibleFrom({
      speciesName: species.name,
      birthDate: effectiveBirthDate,
      ageMonths: effectiveAgeMonths,
      ageRecordedAt: this.ageRecordedAt(effectiveAttributes),
    });
    if (
      data.status === LivestockStatus.AVAILABLE &&
      (listing.status !== LivestockStatus.AVAILABLE ||
        resolveMarketplaceExpiry(listing) <= new Date())
    ) {
      data.marketplaceExpiresAt = listingExpiryFromEligibility(
        data.marketplaceEligibleFrom as Date | null,
      );
    }
    const updated = await super.update(listing.id, data);
    if (complianceSubmissionChanged || assistanceRequestedNow) {
      const compliance = updated.attributes
        ?.marketplaceCompliance as MarketplaceCompliance;
      await this.notifyAdminsOfComplianceSubmission(
        updated,
        marketplaceComplianceEvidenceComplete(compliance),
        Boolean(compliance?.assistance?.requested),
      );
    }
    return updated;
  }

  private normalizeAgeFields(data: DeepPartial<Livestock>): void {
    if (data.birthDate !== undefined && data.birthDate !== null) {
      data.ageMonths = null;
    } else if (data.ageMonths !== undefined && data.ageMonths !== null) {
      data.birthDate = null;
    }
  }

  private requireAgeWhenPublishing(
    status: LivestockStatus | undefined,
    birthDate: string | null | undefined,
    ageMonths: number | null | undefined,
  ): void {
    if (
      status === LivestockStatus.AVAILABLE &&
      !birthDate &&
      (ageMonths === null || ageMonths === undefined)
    ) {
      throw new BadRequestException(
        'Enter a birth date or current age before publishing this livestock',
      );
    }
  }

  async reviewMarketplaceCompliance(
    id: string,
    decision: 'approved' | 'rejected',
    note: string | null,
  ): Promise<Livestock> {
    return this.dataSource.transaction(async (manager) => {
      const listing = await manager
        .createQueryBuilder(Livestock, 'livestock')
        .setLock('pessimistic_write')
        .where('livestock.id = :id', { id })
        .getOne();
      if (!listing) throw new NotFoundException(`Livestock ${id} not found`);

      const compliance = listing.attributes?.marketplaceCompliance as
        MarketplaceCompliance | undefined;
      if (!compliance?.policyVersion) {
        throw new BadRequestException(
          'This legacy listing is not enrolled in the marketplace compliance workflow',
        );
      }
      if (
        decision === 'approved' &&
        !marketplaceComplianceEvidenceComplete(compliance)
      ) {
        throw new BadRequestException(
          'Ear tag ID, veterinary health evidence and vaccination record are required before approval',
        );
      }

      const approved = decision === 'approved';
      const nextCompliance: MarketplaceCompliance = {
        ...compliance,
        reviewStatus: decision,
        reviewNote: note,
        reviewedAt: new Date().toISOString(),
      };
      listing.attributes = {
        ...(listing.attributes ?? {}),
        marketplaceCompliance: nextCompliance,
      };
      const referenceDataApproved =
        listing.speciesApprovalStatus === RequestStatus.APPROVED &&
        listing.breedApprovalStatus === RequestStatus.APPROVED;
      listing.status =
        approved &&
        referenceDataApproved &&
        compliance.requestedStatus === LivestockStatus.AVAILABLE
          ? LivestockStatus.AVAILABLE
          : approved
            ? compliance.requestedStatus || LivestockStatus.DRAFT
            : LivestockStatus.DRAFT;
      if (listing.status === LivestockStatus.AVAILABLE) {
        listing.marketplaceExpiresAt = listingExpiryFromEligibility(
          listing.marketplaceEligibleFrom,
        );
      }
      await manager.save(listing);
      await manager.save(
        manager.create(Notification, {
          userId: listing.farmerId,
          audience: NotificationAudience.FARMER,
          type: NotificationType.REQUEST_UPDATE,
          title: approved
            ? 'Livestock compliance approved'
            : 'Livestock compliance needs changes',
          body: approved
            ? 'Your ear tag, health and vaccination evidence were approved. The listing can now follow your requested marketplace status.'
            : `Your livestock remains a draft.${note ? ` Reason: ${note}` : ' Review the required evidence and resubmit.'}`,
          linkUrl: `/livestock/${listing.id}`,
          relatedType: 'livestock',
          relatedId: listing.id,
        }),
      );
      return listing;
    });
  }

  private async notifyAdminsOfComplianceSubmission(
    listing: Livestock,
    evidenceComplete: boolean,
    assistanceRequested: boolean,
  ): Promise<void> {
    if (!evidenceComplete && !assistanceRequested) return;
    const userRepository = this.dataSource.getRepository(User);
    const notificationRepository = this.dataSource.getRepository(Notification);
    const admins = await userRepository.find({
      where: { role: UserRole.ADMIN },
    });
    if (!admins.length) return;
    await notificationRepository.save(
      admins.map((admin) =>
        notificationRepository.create({
          userId: admin.id,
          audience: NotificationAudience.ADMIN,
          type: NotificationType.REQUEST_UPDATE,
          title: assistanceRequested
            ? 'Livestock registration assistance requested'
            : 'Livestock compliance review required',
          body: assistanceRequested
            ? 'A farmer needs help with DVS-related livestock registration and documentation.'
            : 'A farmer submitted ear tag, veterinary health and vaccination evidence for review.',
          linkUrl: `/admin/livestock/${listing.id}`,
          relatedType: 'livestock',
          relatedId: listing.id,
        }),
      ),
    );
  }

  private ageRecordedAt(
    attributes: DeepPartial<Record<string, unknown>> | null | undefined,
  ): string | null {
    const value = attributes?.ageRecordedAt;
    return typeof value === 'string' ? value : null;
  }

  private async validateReferenceData(
    speciesId: string,
    breedId?: string | null,
  ): Promise<Species> {
    const species = await this.dataSource
      .getRepository(Species)
      .findOne({ where: { id: speciesId, isActive: true } });
    if (!species) throw new BadRequestException('Select an active species');
    if (!breedId) return species;
    const breed = await this.dataSource
      .getRepository(Breed)
      .findOne({ where: { id: breedId, speciesId, isActive: true } });
    if (!breed)
      throw new BadRequestException(
        'Select an active breed that belongs to this species',
      );
    return species;
  }

  async removeOwned(id: string, viewer: AuthenticatedUser): Promise<void> {
    await this.findOwned(id, viewer);

    await this.dataSource.transaction(async (manager) => {
      await this.reservationsService.expireDue(manager, id);

      const listing = await manager
        .createQueryBuilder(Livestock, 'livestock')
        .setLock('pessimistic_write')
        .where('livestock.id = :id', { id })
        .getOne();
      if (!listing) throw new NotFoundException(`Livestock ${id} not found`);

      const reservations = await manager.find(Reservation, {
        where: { livestockId: id },
        order: { createdAt: 'DESC' },
      });
      if (
        reservations.some(
          (reservation) => reservation.status === ReservationStatus.COMPLETED,
        )
      ) {
        throw new ConflictException(
          'This livestock has a completed order and cannot be deleted. It is retained for payment and order history.',
        );
      }
      if (
        reservations.some(
          (reservation) => reservation.status === ReservationStatus.ACTIVE,
        )
      ) {
        throw new ConflictException(
          'This livestock is currently reserved and cannot be deleted while payment is in progress.',
        );
      }
      if (reservations.length > 0) {
        throw new ConflictException(
          'This livestock has order history and cannot be deleted. Set it to unavailable instead.',
        );
      }

      await manager.remove(listing);
    });
  }

  // Fetches a listing and confirms `viewer` owns it (or is an admin). Anyone
  // else gets the exact same 404 a made-up id would return.
  private async findOwned(
    id: string,
    viewer: AuthenticatedUser,
  ): Promise<Livestock> {
    const listing = await this.findOne(id);
    if (viewer.role !== UserRole.ADMIN && listing.farmerId !== viewer.id) {
      throw new NotFoundException(`Livestock ${id} not found`);
    }
    return listing;
  }

  // Admin override: force a listing off the marketplace (or clear that
  // override) regardless of what the derived rule would otherwise compute.
  async setMarketplaceBlock(
    id: string,
    blocked: boolean,
    reason: string | null,
  ): Promise<LivestockWithVisibility> {
    await this.dataSource.transaction(async (manager) => {
      const listing = await manager.findOne(Livestock, { where: { id } });
      if (!listing) throw new NotFoundException(`Livestock ${id} not found`);
      const changed = listing.adminBlocked !== blocked;
      listing.adminBlocked = blocked;
      listing.adminBlockReason = blocked ? reason : null;
      await manager.save(listing);
      if (changed) {
        await manager.save(
          manager.create(Notification, {
            userId: listing.farmerId,
            audience: NotificationAudience.FARMER,
            type: NotificationType.LISTING,
            title: blocked ? 'Listing hidden by admin' : 'Listing restored',
            body: blocked
              ? `Your livestock listing was hidden from the marketplace.${reason ? ` Reason: ${reason}` : ''}`
              : 'The admin restriction was removed from your livestock listing.',
            linkUrl: `/livestock/${listing.id}`,
            relatedType: 'livestock',
            relatedId: listing.id,
          }),
        );
      }
    });
    return this.findOneWithVisibility(id);
  }

  // Admin-only, same shape as setMarketplaceBlock: isFeatured is a homepage
  // curation decision, not something a farmer can grant their own listing.
  async setFeatured(
    id: string,
    featured: boolean,
  ): Promise<LivestockWithVisibility> {
    await this.dataSource.transaction(async (manager) => {
      const listing = await manager.findOne(Livestock, { where: { id } });
      if (!listing) throw new NotFoundException(`Livestock ${id} not found`);
      const changed = listing.isFeatured !== featured;
      listing.isFeatured = featured;
      await manager.save(listing);
      if (changed) {
        await manager.save(
          manager.create(Notification, {
            userId: listing.farmerId,
            audience: NotificationAudience.FARMER,
            type: NotificationType.LISTING,
            title: featured ? 'Listing featured' : 'Listing no longer featured',
            body: featured
              ? 'Your livestock listing was selected for featured placement.'
              : 'Your livestock listing was removed from featured placement. It remains available in the marketplace if eligible.',
            linkUrl: `/livestock/${listing.id}`,
            relatedType: 'livestock',
            relatedId: listing.id,
          }),
        );
      }
    });
    return this.findOneWithVisibility(id);
  }

  // Used by the order checkout flow inside its own transaction, hence the
  // optional manager — falls back to this service's own repository outside one.
  async markSold(id: string, manager?: EntityManager): Promise<void> {
    const run = async (entityManager: EntityManager): Promise<void> => {
      const listing = await entityManager
        .createQueryBuilder(Livestock, 'livestock')
        .setLock('pessimistic_write')
        .where('livestock.id = :id', { id })
        .getOne();
      if (!listing) throw new NotFoundException(`Livestock ${id} not found`);

      const farmerProfile = await entityManager.findOne(FarmerProfile, {
        where: { userId: listing.farmerId },
      });
      const visibility = computeMarketplaceVisibility(
        listing,
        farmerProfile?.verificationStatus ?? VerificationStatus.UNVERIFIED,
      );
      if (!visibility.marketplaceVisible) {
        throw new ConflictException(
          `Livestock ${id} is no longer available for purchase`,
        );
      }

      listing.status = LivestockStatus.SOLD;
      listing.soldAt = new Date();
      await entityManager.save(listing);
    };

    if (manager) return run(manager);
    return this.dataSource.transaction(run);
  }

  // Inverse of markSold — used when an order containing this listing is
  // cancelled or refunded. Row-locked like markSold's counterpart on
  // BulkListing, since two concurrent cancel/refund operations on orders
  // that (somehow) share a listing must not both release it. Always sets
  // AVAILABLE specifically (never restores some prior status), and is a
  // no-op if the listing is already available.
  async releaseToAvailable(id: string, manager?: EntityManager): Promise<void> {
    const run = async (entityManager: EntityManager): Promise<void> => {
      const listing = await entityManager
        .createQueryBuilder(Livestock, 'livestock')
        .setLock('pessimistic_write')
        .where('livestock.id = :id', { id })
        .getOne();

      if (!listing) return; // order item pointed at a listing that no longer exists
      if (listing.status === LivestockStatus.AVAILABLE) return; // idempotent no-op

      const expiresAt = resolveMarketplaceExpiry(listing);
      listing.status =
        expiresAt > new Date()
          ? LivestockStatus.AVAILABLE
          : LivestockStatus.UNAVAILABLE;
      listing.soldAt = null;
      listing.marketplaceExpiresAt = expiresAt;
      await entityManager.save(listing);
    };

    if (manager) return run(manager);
    return this.dataSource.transaction(run);
  }

  // Reconciles the legacy expiry stored in attributes with the canonical
  // column, then expires listings before any buyer browse response is built.
  // The status transition makes this idempotent and prevents duplicate alerts.
  async expireDueListings(manager?: EntityManager): Promise<number> {
    const run = async (entityManager: EntityManager): Promise<number> => {
      const listings = await entityManager
        .createQueryBuilder(Livestock, 'livestock')
        .setLock('pessimistic_write')
        .where('livestock.status = :available', {
          available: LivestockStatus.AVAILABLE,
        })
        .getMany();
      const now = new Date();
      let expiredCount = 0;

      for (const listing of listings) {
        const expiresAt = resolveMarketplaceExpiry(listing);
        if (expiresAt > now) continue;

        listing.status = LivestockStatus.UNAVAILABLE;
        listing.marketplaceExpiresAt = expiresAt;
        await entityManager.save(listing);
        await entityManager.save(
          entityManager.create(Notification, {
            userId: listing.farmerId,
            audience: NotificationAudience.FARMER,
            type: NotificationType.LISTING,
            title: 'Listing expired',
            body: 'Your livestock listing expired and is hidden from buyers. Review and renew it to return it to the marketplace.',
            linkUrl: `/livestock/${listing.id}`,
            relatedType: 'livestock',
            relatedId: listing.id,
          }),
        );
        expiredCount += 1;
      }
      return expiredCount;
    };

    if (manager) return run(manager);
    return this.dataSource.transaction(run);
  }
}

export function resolveMarketplaceExpiry(
  listing: Pick<Livestock, 'marketplaceExpiresAt' | 'createdAt'> & {
    attributes?: Record<string, unknown> | null;
  },
): Date {
  const canonical = listing.marketplaceExpiresAt?.getTime();
  const legacyValue = listing.attributes?.listingExpiresAt;
  const legacy =
    typeof legacyValue === 'string' ? Date.parse(legacyValue) : Number.NaN;
  const candidates = [canonical, legacy].filter(
    (value): value is number =>
      typeof value === 'number' && Number.isFinite(value),
  );
  const expiry = candidates.length
    ? Math.min(...candidates)
    : listing.createdAt.getTime() + LISTING_LIFETIME_MS;
  return new Date(expiry);
}

export function computeMarketplaceVisibility(
  listing: Pick<
    Livestock,
    | 'status'
    | 'adminBlocked'
    | 'adminBlockReason'
    | 'speciesApprovalStatus'
    | 'breedApprovalStatus'
    | 'breedId'
    | 'marketplaceEligibleFrom'
    | 'marketplaceExpiresAt'
    | 'createdAt'
  >,
  farmerVerificationStatus: VerificationStatus,
): DerivedMarketplaceVisibility {
  if (listing.status !== LivestockStatus.AVAILABLE) {
    return {
      marketplaceVisible: false,
      marketplaceVisibilityReason: `Listing is ${listing.status}`,
    };
  }
  if (listing.adminBlocked) {
    return {
      marketplaceVisible: false,
      marketplaceVisibilityReason:
        listing.adminBlockReason ?? 'Blocked by admin',
    };
  }
  if (farmerVerificationStatus !== VerificationStatus.VERIFIED) {
    return {
      marketplaceVisible: false,
      marketplaceVisibilityReason: 'Farmer is not verified',
    };
  }
  if (listing.speciesApprovalStatus !== RequestStatus.APPROVED) {
    return {
      marketplaceVisible: false,
      marketplaceVisibilityReason:
        listing.speciesApprovalStatus === RequestStatus.REJECTED
          ? 'Species request was rejected'
          : 'Species is pending approval',
    };
  }
  if (listing.breedApprovalStatus !== RequestStatus.APPROVED) {
    return {
      marketplaceVisible: false,
      marketplaceVisibilityReason:
        listing.breedApprovalStatus === RequestStatus.REJECTED
          ? 'Breed request was rejected'
          : 'Breed is pending approval',
    };
  }
  if (
    listing.marketplaceEligibleFrom &&
    listing.marketplaceEligibleFrom > new Date()
  ) {
    return {
      marketplaceVisible: false,
      marketplaceVisibilityReason: 'Not yet eligible for marketplace',
    };
  }
  const expiresAt = resolveMarketplaceExpiry(listing);
  if (expiresAt <= new Date()) {
    return {
      marketplaceVisible: false,
      marketplaceVisibilityReason: 'Listing expired after 14 days',
    };
  }
  return { marketplaceVisible: true, marketplaceVisibilityReason: null };
}

export interface MarketplaceAgeInput {
  speciesName: string;
  birthDate?: string | null;
  ageMonths?: number | null;
  ageRecordedAt?: string | null;
  now?: Date;
}

/**
 * Returns the first instant at which an animal may appear to buyers.
 * A null result means it already meets the policy or the species has no rule.
 * The client never supplies the stored eligibility date; the API derives it
 * from age evidence every time the relevant listing data is saved.
 */
export function computeMarketplaceEligibleFrom({
  speciesName,
  birthDate,
  ageMonths,
  ageRecordedAt,
  now = new Date(),
}: MarketplaceAgeInput): Date | null {
  const minimum = MIN_MARKETPLACE_AGE_MONTHS[speciesName];
  if (!minimum) return null;

  let eligibleFrom: Date | null = null;
  if (birthDate) {
    const born = parseDateOnly(birthDate);
    if (!born || born > now) {
      throw new BadRequestException('Birth date must be a valid past date');
    }
    eligibleFrom = addCalendarMonthsUtc(born, minimum);
  } else if (ageMonths !== null && ageMonths !== undefined) {
    if (!Number.isInteger(ageMonths) || ageMonths < 0) {
      throw new BadRequestException('Age in months must be a positive integer');
    }
    if (ageMonths >= minimum) return null;
    const recordedAt = ageRecordedAt ? parseDateOnly(ageRecordedAt) : null;
    const base = recordedAt && recordedAt <= now ? recordedAt : now;
    eligibleFrom = addCalendarMonthsUtc(base, minimum - ageMonths);
  }

  return eligibleFrom && eligibleFrom > now ? eligibleFrom : null;
}

function parseDateOnly(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const result = new Date(Date.UTC(year, month - 1, day));
  if (
    result.getUTCFullYear() !== year ||
    result.getUTCMonth() !== month - 1 ||
    result.getUTCDate() !== day
  ) {
    return null;
  }
  return result;
}

function addCalendarMonthsUtc(date: Date, months: number): Date {
  const targetMonth = date.getUTCMonth() + months;
  const year = date.getUTCFullYear() + Math.floor(targetMonth / 12);
  const month = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(date.getUTCDate(), lastDay)));
}

function listingExpiryFromEligibility(eligibleFrom: Date | null): Date {
  const windowStartsAt = Math.max(Date.now(), eligibleFrom?.getTime() ?? 0);
  return new Date(windowStartsAt + LISTING_LIFETIME_MS);
}
