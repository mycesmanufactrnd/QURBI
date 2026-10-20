import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import {
  CourierProfile,
  CourierVerificationStatus,
  UserRole,
} from '../entities';
import { ApprovedCourierGuard } from './approved-courier.guard';
import { haversineMeters, parseCoords } from '../courier-jobs/geo';

// @nestjs/typeorm@12 is ESM-only while this repository's Jest runtime is
// CommonJS.
jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

function contextFor(request: object): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('ApprovedCourierGuard', () => {
  function guardFor(profile: Partial<CourierProfile> | null) {
    const repo = { findOne: jest.fn().mockResolvedValue(profile) };
    return new ApprovedCourierGuard(repo as never);
  }

  it('lets an approved courier through and exposes the profile', async () => {
    const profile = {
      id: 'cp-1',
      verificationStatus: CourierVerificationStatus.APPROVED,
    };
    const request: { user: object; courierProfile?: unknown } = {
      user: { id: 'u1', role: UserRole.COURIER },
    };
    await expect(
      guardFor(profile).canActivate(contextFor(request)),
    ).resolves.toBe(true);
    expect(request.courierProfile).toBe(profile);
  });

  it.each([
    CourierVerificationStatus.UNVERIFIED,
    CourierVerificationStatus.PENDING,
    CourierVerificationStatus.REJECTED,
    CourierVerificationStatus.SUSPENDED,
  ])('blocks a %s courier', async (verificationStatus) => {
    await expect(
      guardFor({ verificationStatus }).canActivate(
        contextFor({ user: { id: 'u1', role: UserRole.COURIER } }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it.each([UserRole.BUYER, UserRole.FARMER, UserRole.ADMIN])(
    'blocks a %s even if a courier profile exists for the id',
    async (role) => {
      await expect(
        guardFor({ verificationStatus: CourierVerificationStatus.APPROVED }).canActivate(
          contextFor({ user: { id: 'u1', role } }),
        ),
      ).rejects.toThrow(ForbiddenException);
    },
  );

  it('blocks an unauthenticated request and a courier without a profile', async () => {
    await expect(
      guardFor(null).canActivate(contextFor({})),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      guardFor(null).canActivate(
        contextFor({ user: { id: 'u1', role: UserRole.COURIER } }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});

describe('geo helpers', () => {
  it('measures a known distance roughly right', () => {
    // Klang to Shah Alam is about 13 km.
    const km =
      haversineMeters(
        { lat: 3.0449, lng: 101.4455 },
        { lat: 3.0738, lng: 101.5183 },
      ) / 1000;
    expect(km).toBeGreaterThan(8);
    expect(km).toBeLessThan(13);
    expect(haversineMeters({ lat: 1, lng: 1 }, { lat: 1, lng: 1 })).toBe(0);
  });

  it('treats missing, invalid and 0,0 coordinates as unknown', () => {
    expect(parseCoords(null, '101')).toBeNull();
    expect(parseCoords('abc', '101')).toBeNull();
    expect(parseCoords('0', '0')).toBeNull();
    expect(parseCoords('3.1', '101.6')).toEqual({ lat: 3.1, lng: 101.6 });
  });
});
