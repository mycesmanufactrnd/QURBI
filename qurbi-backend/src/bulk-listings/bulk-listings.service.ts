import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, FindOptionsWhere, Repository } from 'typeorm';
import { BulkListing, BulkListingStatus } from '../entities';
import { BaseCrudService } from '../common/base-crud.service';

@Injectable()
export class BulkListingsService extends BaseCrudService<BulkListing> {
  constructor(
    @InjectRepository(BulkListing) repository: Repository<BulkListing>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {
    super(repository);
  }

  findAll(where?: FindOptionsWhere<BulkListing>): Promise<BulkListing[]> {
    return this.repository.find({
      where,
      relations: { species: true, breed: true },
      order: { createdAt: 'DESC' },
    });
  }

  // Reserves `quantity` shares atomically. Must run under a row lock:
  // without it, two buyers checking out at the same instant can both read
  // "1 share left" and both succeed, overselling the animal. Pass `manager`
  // when this is one step of a larger transaction (e.g. order checkout) so it
  // joins that transaction instead of opening a nested one.
  async reserveShares(
    id: string,
    quantity: number,
    manager?: EntityManager,
  ): Promise<BulkListing> {
    const run = async (entityManager: EntityManager): Promise<BulkListing> => {
      const listing = await entityManager
        .createQueryBuilder(BulkListing, 'bulk_listing')
        .setLock('pessimistic_write')
        .where('bulk_listing.id = :id', { id })
        .getOne();

      if (!listing) {
        throw new NotFoundException(`BulkListing ${id} not found`);
      }
      if (listing.sharesSold + quantity > listing.totalShares) {
        throw new ConflictException(
          `Only ${listing.totalShares - listing.sharesSold} share(s) left on this listing`,
        );
      }

      listing.sharesSold += quantity;
      listing.status =
        listing.sharesSold >= listing.totalShares
          ? BulkListingStatus.FULFILLED
          : BulkListingStatus.OPEN;

      return entityManager.save(listing);
    };

    if (manager) return run(manager);
    return this.dataSource.transaction(run);
  }

  // Inverse of reserveShares — used when an order containing bulk shares is
  // cancelled/refunded and the shares need to go back on sale.
  async releaseShares(
    id: string,
    quantity: number,
    manager?: EntityManager,
  ): Promise<BulkListing> {
    const run = async (entityManager: EntityManager): Promise<BulkListing> => {
      const listing = await entityManager
        .createQueryBuilder(BulkListing, 'bulk_listing')
        .setLock('pessimistic_write')
        .where('bulk_listing.id = :id', { id })
        .getOne();

      if (!listing) {
        throw new NotFoundException(`BulkListing ${id} not found`);
      }

      listing.sharesSold = Math.max(0, listing.sharesSold - quantity);
      if (listing.status === BulkListingStatus.FULFILLED) {
        listing.status = BulkListingStatus.OPEN;
      }

      return entityManager.save(listing);
    };

    if (manager) return run(manager);
    return this.dataSource.transaction(run);
  }
}
