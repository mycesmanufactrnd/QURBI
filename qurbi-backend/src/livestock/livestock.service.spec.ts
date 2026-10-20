import {
  LivestockStatus,
  Notification,
  NotificationAudience,
  RequestStatus,
  ReservationStatus,
  VerificationStatus,
} from '../entities';
import {
  computeMarketplaceEligibleFrom,
  computeMarketplaceVisibility,
  LISTING_LIFETIME_MS,
  LivestockService,
  marketplaceComplianceEvidenceComplete,
  resolveMarketplaceExpiry,
} from './livestock.service';

jest.mock('@nestjs/typeorm', () => ({
  InjectDataSource: () => () => undefined,
  InjectRepository: () => () => undefined,
}));

describe('computeMarketplaceEligibleFrom', () => {
  const now = new Date('2026-10-09T00:00:00.000Z');

  it('holds a calf until it reaches the six-month cow threshold', () => {
    expect(
      computeMarketplaceEligibleFrom({
        speciesName: 'Cow',
        birthDate: '2026-07-15',
        now,
      }),
    ).toEqual(new Date('2027-01-15T00:00:00.000Z'));
  });

  it('holds a three-month-old goat for one more month', () => {
    expect(
      computeMarketplaceEligibleFrom({
        speciesName: 'Goat',
        ageMonths: 3,
        ageRecordedAt: '2026-10-09',
        now,
      }),
    ).toEqual(new Date('2026-11-09T00:00:00.000Z'));
  });

  it('returns null when the animal already meets the minimum age', () => {
    expect(
      computeMarketplaceEligibleFrom({
        speciesName: 'Cow',
        ageMonths: 6,
        now,
      }),
    ).toBeNull();
  });

  it('rejects a future birth date', () => {
    expect(() =>
      computeMarketplaceEligibleFrom({
        speciesName: 'Goat',
        birthDate: '2026-10-10',
        now,
      }),
    ).toThrow('Birth date must be a valid past date');
  });
});

describe('computeMarketplaceVisibility', () => {
  const now = Date.now();
  const visibleListing = {
    status: LivestockStatus.AVAILABLE,
    adminBlocked: false,
    adminBlockReason: null,
    speciesApprovalStatus: RequestStatus.APPROVED,
    breedApprovalStatus: RequestStatus.APPROVED,
    breedId: 'breed-1',
    marketplaceEligibleFrom: null,
    marketplaceExpiresAt: new Date(now + LISTING_LIFETIME_MS),
    createdAt: new Date(now),
  };

  it('shows a current approved listing from a verified farmer', () => {
    expect(
      computeMarketplaceVisibility(visibleListing, VerificationStatus.VERIFIED),
    ).toEqual({ marketplaceVisible: true, marketplaceVisibilityReason: null });
  });

  it.each([
    LivestockStatus.DRAFT,
    LivestockStatus.RESERVED,
    LivestockStatus.SOLD,
    LivestockStatus.UNAVAILABLE,
  ])('hides a listing with %s status', (status) => {
    expect(
      computeMarketplaceVisibility(
        { ...visibleListing, status },
        VerificationStatus.VERIFIED,
      ).marketplaceVisible,
    ).toBe(false);
  });

  it('hides an expired listing', () => {
    const result = computeMarketplaceVisibility(
      { ...visibleListing, marketplaceExpiresAt: new Date(now - 1) },
      VerificationStatus.VERIFIED,
    );

    expect(result).toEqual({
      marketplaceVisible: false,
      marketplaceVisibilityReason: 'Listing expired after 14 days',
    });
  });

  it('uses the earlier legacy expiry when an automatic release extended the canonical date', () => {
    const legacyExpiry = new Date(now - 1);
    const listing = {
      ...visibleListing,
      marketplaceExpiresAt: new Date(now + LISTING_LIFETIME_MS),
      attributes: { listingExpiresAt: legacyExpiry.toISOString() },
    };

    expect(resolveMarketplaceExpiry(listing)).toEqual(legacyExpiry);
    expect(
      computeMarketplaceVisibility(listing, VerificationStatus.VERIFIED)
        .marketplaceVisible,
    ).toBe(false);
  });

  it('uses createdAt plus 14 days for a legacy listing without an expiry date', () => {
    const result = computeMarketplaceVisibility(
      {
        ...visibleListing,
        marketplaceExpiresAt: null,
        createdAt: new Date(now - LISTING_LIFETIME_MS - 1),
      },
      VerificationStatus.VERIFIED,
    );

    expect(result.marketplaceVisible).toBe(false);
  });

  it('hides an approved listing from an unverified farmer', () => {
    expect(
      computeMarketplaceVisibility(visibleListing, VerificationStatus.PENDING)
        .marketplaceVisible,
    ).toBe(false);
  });

  it('hides an unspecified breed after its breed request is rejected', () => {
    const result = computeMarketplaceVisibility(
      {
        ...visibleListing,
        breedId: null,
        breedApprovalStatus: RequestStatus.REJECTED,
      },
      VerificationStatus.VERIFIED,
    );

    expect(result).toEqual({
      marketplaceVisible: false,
      marketplaceVisibilityReason: 'Breed request was rejected',
    });
  });
});

describe('marketplace compliance policy', () => {
  it('requires an animal ID plus health and vaccination evidence', () => {
    expect(
      marketplaceComplianceEvidenceComplete({
        earTagId: 'DVS-SGR-001',
        healthCertificateUrl: '/uploads/private/health',
        vaccinationRecordUrl: '/uploads/private/vaccine',
      }),
    ).toBe(true);
    expect(
      marketplaceComplianceEvidenceComplete({
        earTagId: 'DVS-SGR-001',
        healthCertificateUrl: '/uploads/private/health',
      }),
    ).toBe(false);
  });

  it('forces a new listing to draft and ignores client self-approval', async () => {
    const repository = {
      create: jest.fn((value: unknown) => value),
      save: jest.fn((value: unknown) =>
        Promise.resolve({ ...(value as object), id: 'livestock-1' }),
      ),
    };
    const speciesRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'species-1', name: 'Cow' }),
    };
    const userRepository = { find: jest.fn().mockResolvedValue([]) };
    const dataSource = {
      getRepository: jest.fn((entity: { name?: string }) =>
        entity?.name === 'Species' ? speciesRepository : userRepository,
      ),
    };
    const service = new LivestockService(
      repository as never,
      dataSource as never,
      {} as never,
    );

    const result = await service.createForFarmer('farmer-1', {
      speciesId: 'species-1',
      title: 'Cow - Brahman',
      tagNumber: 'DVS-SGR-001',
      price: '2500',
      images: ['/uploads/public/cow.jpg'],
      status: LivestockStatus.AVAILABLE,
      ageMonths: 18,
      attributes: {
        marketplaceCompliance: {
          earTagId: 'DVS-SGR-001',
          healthCertificateUrl: '/uploads/private/health',
          vaccinationRecordUrl: '/uploads/private/vaccine',
          reviewStatus: 'approved',
        },
      },
    } as never);

    expect(result.status).toBe(LivestockStatus.DRAFT);
    expect(result.attributes?.marketplaceCompliance.reviewStatus).toBe(
      'pending',
    );
    expect(result.attributes?.marketplaceCompliance.requestedStatus).toBe(
      LivestockStatus.AVAILABLE,
    );
  });
});

describe('LivestockService expiry enforcement', () => {
  it('marks an expired listing unavailable and notifies its farmer once', async () => {
    const legacyExpiry = new Date(Date.now() - 60_000);
    const listing = {
      id: 'livestock-1',
      farmerId: 'farmer-1',
      status: LivestockStatus.AVAILABLE,
      marketplaceExpiresAt: new Date(Date.now() + LISTING_LIFETIME_MS),
      createdAt: new Date(),
      attributes: { listingExpiresAt: legacyExpiry.toISOString() },
    };
    const queryBuilder = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([listing]),
    };
    const manager = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      create: jest.fn((_entity: unknown, value: unknown) => value),
      save: jest.fn((value: unknown) => Promise.resolve(value)),
    };
    const service = new LivestockService({} as never, {} as never, {} as never);

    await expect(service.expireDueListings(manager as never)).resolves.toBe(1);

    expect(listing.status).toBe(LivestockStatus.UNAVAILABLE);
    expect(listing.marketplaceExpiresAt).toEqual(legacyExpiry);
    expect(manager.create).toHaveBeenCalledWith(
      Notification,
      expect.objectContaining({
        userId: listing.farmerId,
        audience: NotificationAudience.FARMER,
        title: 'Listing expired',
        relatedId: listing.id,
      }),
    );
  });
});

describe('LivestockService publishing approval rules', () => {
  it('rejects publishing when an unspecified breed request was rejected', async () => {
    const listing = {
      id: 'livestock-1',
      farmerId: 'farmer-1',
      speciesId: 'species-1',
      breedId: null,
      speciesApprovalStatus: RequestStatus.APPROVED,
      breedApprovalStatus: RequestStatus.REJECTED,
    };
    const repository = {
      findOne: jest.fn().mockResolvedValue(listing),
    };
    const dataSource = {
      getRepository: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue({ id: 'species-1' }),
      }),
    };
    const service = new LivestockService(
      repository as never,
      dataSource as never,
      {} as never,
    );

    await expect(
      service.updateOwned(
        listing.id,
        { id: listing.farmerId, role: 'farmer' } as never,
        { status: LivestockStatus.AVAILABLE, breedId: null },
      ),
    ).rejects.toThrow(
      'This livestock cannot be published until an approved breed is selected',
    );
  });

  it.each([LivestockStatus.SOLD, LivestockStatus.RESERVED])(
    'rejects farmer edits when the current listing is %s',
    async (status) => {
      const listing = {
        id: 'livestock-1',
        farmerId: 'farmer-1',
        status,
      };
      const repository = {
        findOne: jest.fn().mockResolvedValue(listing),
      };
      const service = new LivestockService(
        repository as never,
        {} as never,
        {} as never,
      );

      await expect(
        service.updateOwned(
          listing.id,
          { id: listing.farmerId, role: 'farmer' } as never,
          { title: 'Attempted edit' },
        ),
      ).rejects.toThrow(
        status === LivestockStatus.SOLD
          ? 'Sold livestock cannot be edited or republished'
          : 'Reserved livestock cannot be edited',
      );
    },
  );
});

describe('LivestockService deletion safeguards', () => {
  const listing = {
    id: 'livestock-1',
    farmerId: 'farmer-1',
    status: LivestockStatus.SOLD,
  };

  function setup(reservations: Array<{ status: ReservationStatus }>) {
    const repository = {
      findOne: jest.fn().mockResolvedValue(listing),
    };
    const queryBuilder = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(listing),
    };
    const manager = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      find: jest.fn().mockResolvedValue(reservations),
      remove: jest.fn().mockResolvedValue(listing),
    };
    const dataSource = {
      transaction: jest.fn(
        (work: (activeManager: typeof manager) => Promise<unknown>) =>
          work(manager),
      ),
    };
    const reservationsService = {
      expireDue: jest.fn().mockResolvedValue(0),
    };
    const service = new LivestockService(
      repository as never,
      dataSource as never,
      reservationsService as never,
    );
    return { service, manager };
  }

  it('returns a clear conflict instead of a database error for sold livestock', async () => {
    const { service, manager } = setup([
      { status: ReservationStatus.COMPLETED },
    ]);

    await expect(
      service.removeOwned(listing.id, {
        id: listing.farmerId,
        role: 'farmer',
      } as never),
    ).rejects.toThrow('completed order and cannot be deleted');
    expect(manager.remove).not.toHaveBeenCalled();
  });

  it('deletes a listing that has no reservation history', async () => {
    const { service, manager } = setup([]);

    await service.removeOwned(listing.id, {
      id: listing.farmerId,
      role: 'farmer',
    } as never);

    expect(manager.remove).toHaveBeenCalledWith(listing);
  });
});
