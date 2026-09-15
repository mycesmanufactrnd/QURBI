import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DeepPartial,
  EntityManager,
  FindOptionsWhere,
  LessThanOrEqual,
  MoreThan,
  Repository,
} from 'typeorm';
import { Livestock, LivestockStatus, ReservationState } from '../entities';
import { BaseCrudService } from '../common/base-crud.service';
import {
  hasActiveReservation,
  isListingExpired,
  listingWindow,
} from './listing-policy';

@Injectable()
export class LivestockService extends BaseCrudService<Livestock> {
  constructor(@InjectRepository(Livestock) repository: Repository<Livestock>) {
    super(repository);
  }

  createForFarmer(
    farmerId: string,
    data: DeepPartial<Livestock>,
  ): Promise<Livestock> {
    const now = new Date();
    const window = listingWindow(now);
    return this.repository.save(
      this.repository.create({
        ...data,
        farmerId,
        status: LivestockStatus.AVAILABLE,
        disabled: false,
        ...window,
        listingRenewedAt: null,
        reservationState: null,
        reservationOrderId: null,
        reservationBuyerId: null,
        reservationExpiresAt: null,
      }),
    );
  }

  findMarketplace(now = new Date()): Promise<Livestock[]> {
    return this.repository.find({
      where: {
        status: LivestockStatus.AVAILABLE,
        disabled: false,
        listingExpiresAt: MoreThan(now),
      },
      relations: { species: true, breed: true, category: true },
      order: { createdAt: 'DESC' },
    });
  }

  findMine(farmerId: string): Promise<Livestock[]> {
    return this.findAll({ farmerId });
  }

  async findMarketplaceOne(id: string): Promise<Livestock> {
    const listing = await this.repository.findOne({
      where: {
        id,
        status: LivestockStatus.AVAILABLE,
        disabled: false,
        listingExpiresAt: MoreThan(new Date()),
      },
      relations: { species: true, breed: true, category: true },
    });
    if (!listing)
      throw new NotFoundException('Livestock listing is not available');
    await this.repository.increment({ id }, 'viewCount', 1);
    listing.viewCount += 1;
    return listing;
  }

  async updateOwned(
    id: string,
    farmerId: string,
    data: DeepPartial<Livestock>,
  ): Promise<Livestock> {
    const listing = await this.findOne(id);
    if (listing.farmerId !== farmerId) {
      throw new ForbiddenException('This livestock belongs to another farmer');
    }
    if (hasActiveReservation(listing)) {
      throw new ConflictException(
        'This livestock is locked while a buyer completes payment',
      );
    }
    const safeData = { ...data };
    const serverManagedFields: (keyof Livestock)[] = [
      'farmerId',
      'reservationState',
      'reservationOrderId',
      'reservationBuyerId',
      'reservationExpiresAt',
      'listingPublishedAt',
      'listingExpiresAt',
      'listingRenewedAt',
      'disabled',
      'isFeatured',
      'soldAt',
    ];
    for (const field of serverManagedFields) delete safeData[field];
    return this.update(id, safeData);
  }

  async renew(
    id: string,
    farmerId: string,
    data: DeepPartial<Livestock>,
  ): Promise<Livestock> {
    const listing = await this.findOne(id);
    if (listing.farmerId !== farmerId) {
      throw new ForbiddenException('This livestock belongs to another farmer');
    }
    if (hasActiveReservation(listing)) {
      throw new ConflictException(
        'This livestock is locked while a buyer completes payment',
      );
    }
    if (listing.status === LivestockStatus.SOLD) {
      throw new ConflictException('A sold livestock cannot be renewed');
    }

    const now = new Date();
    const window = listingWindow(now);
    const updated = await this.updateOwned(id, farmerId, data);
    await this.repository.update(id, {
      status: LivestockStatus.AVAILABLE,
      ...window,
      listingRenewedAt: now,
    });
    return this.findOne(updated.id);
  }

  async reserveForOrder(
    id: string,
    orderId: string,
    buyerId: string,
    expiresAt: Date,
    manager: EntityManager,
  ): Promise<Livestock> {
    const repository = manager.getRepository(Livestock);
    const listing = await repository.findOne({
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!listing)
      throw new ConflictException('Livestock listing no longer exists');

    const now = new Date();
    if (
      listing.status === LivestockStatus.RESERVED &&
      listing.reservationState === ReservationState.ACTIVE &&
      listing.reservationOrderId === orderId &&
      listing.reservationExpiresAt &&
      listing.reservationExpiresAt > now
    )
      return listing;

    const reservationExpired =
      listing.reservationExpiresAt && listing.reservationExpiresAt <= now;
    if (listing.status === LivestockStatus.RESERVED && reservationExpired) {
      listing.status = LivestockStatus.AVAILABLE;
      listing.reservationState = ReservationState.EXPIRED;
    }

    if (
      listing.disabled ||
      listing.status !== LivestockStatus.AVAILABLE ||
      isListingExpired(listing, now)
    ) {
      throw new ConflictException(
        'Livestock listing is unavailable or expired',
      );
    }

    listing.status = LivestockStatus.RESERVED;
    listing.reservationState = ReservationState.ACTIVE;
    listing.reservationOrderId = orderId;
    listing.reservationBuyerId = buyerId;
    listing.reservationExpiresAt = expiresAt;
    return repository.save(listing);
  }

  async releaseOrderReservations(
    orderId: string,
    manager: EntityManager,
    state = ReservationState.RELEASED,
  ): Promise<void> {
    await manager.getRepository(Livestock).update(
      {
        reservationOrderId: orderId,
        status: LivestockStatus.RESERVED,
        reservationState: ReservationState.ACTIVE,
      },
      {
        status: LivestockStatus.AVAILABLE,
        reservationState: state,
      },
    );
  }

  async finalizeOrderReservations(
    orderId: string,
    manager: EntityManager,
  ): Promise<void> {
    await manager.getRepository(Livestock).update(
      {
        reservationOrderId: orderId,
        status: LivestockStatus.RESERVED,
        reservationState: ReservationState.ACTIVE,
      },
      {
        status: LivestockStatus.SOLD,
        reservationState: ReservationState.COMPLETED,
        soldAt: new Date(),
      },
    );
  }

  async releaseExpiredReservations(now = new Date()): Promise<number> {
    const result = await this.repository.update(
      {
        status: LivestockStatus.RESERVED,
        reservationState: ReservationState.ACTIVE,
        reservationExpiresAt: LessThanOrEqual(now),
      },
      {
        status: LivestockStatus.AVAILABLE,
        reservationState: ReservationState.EXPIRED,
      },
    );
    return result.affected || 0;
  }

  findAll(where?: FindOptionsWhere<Livestock>): Promise<Livestock[]> {
    return this.repository.find({
      where,
      relations: { species: true, breed: true, category: true },
      order: { createdAt: 'DESC' },
    });
  }

  // Used by the order checkout flow inside its own transaction, hence the
  // optional manager — falls back to this service's own repository outside one.
  async markSold(id: string, manager?: EntityManager): Promise<void> {
    const repo = manager ? manager.getRepository(Livestock) : this.repository;
    await repo.update(id, { status: LivestockStatus.SOLD, soldAt: new Date() });
  }
}
