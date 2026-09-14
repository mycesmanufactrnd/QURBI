import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, FindOptionsWhere, Repository } from 'typeorm';
import { Livestock, LivestockStatus } from '../entities';
import { BaseCrudService } from '../common/base-crud.service';

@Injectable()
export class LivestockService extends BaseCrudService<Livestock> {
  constructor(@InjectRepository(Livestock) repository: Repository<Livestock>) {
    super(repository);
  }

  findAll(where?: FindOptionsWhere<Livestock>): Promise<Livestock[]> {
    return this.repository.find({
      where,
      relations: { species: true, breed: true, category: true },
      order: { createdAt: 'DESC' },
    });
  }

  // Public "view" endpoint: fetch and bump viewCount in one call so browsing
  // the buyer app organically tracks popularity.
  async findOneAndTrackView(id: string): Promise<Livestock> {
    const listing = await this.findOne(id);
    await this.repository.increment({ id }, 'viewCount', 1);
    listing.viewCount += 1;
    return listing;
  }

  // Used by the order checkout flow inside its own transaction, hence the
  // optional manager — falls back to this service's own repository outside one.
  async markSold(id: string, manager?: EntityManager): Promise<void> {
    const repo = manager ? manager.getRepository(Livestock) : this.repository;
    await repo.update(id, { status: LivestockStatus.SOLD, soldAt: new Date() });
  }
}
