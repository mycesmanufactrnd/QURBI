import {
  LivestockStatus,
  RequestStatus,
  VerificationStatus,
} from '../entities';
import {
  computeMarketplaceVisibility,
  LISTING_LIFETIME_MS,
  LivestockService,
} from './livestock.service';

jest.mock('@nestjs/typeorm', () => ({
  InjectDataSource: () => () => undefined,
  InjectRepository: () => () => undefined,
}));

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
});
