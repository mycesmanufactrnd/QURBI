import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';
import {
  Breed,
  BreedRequest,
  Livestock,
  RequestStatus,
  UserRole,
} from '../entities';
import { Breed, BreedRequest, Livestock, LivestockStatus, RequestStatus, UserRole } from '../entities';
import { BaseCrudService } from '../common/base-crud.service';
import { slugify } from '../common/slugify';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { Paginated, PageQuery, resolvePage } from '../common/pagination';
import { LISTING_LIFETIME_MS } from '../livestock/livestock.service';

export interface BreedRequestsQuery extends PageQuery {
  requestedByUserId?: string;
  speciesId?: string;
  status?: RequestStatus;
}

@Injectable()
export class BreedRequestsService extends BaseCrudService<BreedRequest> {
  constructor(
    @InjectRepository(BreedRequest) repository: Repository<BreedRequest>,
    @InjectRepository(Breed)
    private readonly breedRepository: Repository<Breed>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {
    super(repository);
  }

  // A non-admin is always scoped to their own requests, regardless of what
  // (if anything) they pass as requestedByUserId — only an admin can look up
  // another user's, or everyone's. speciesId stays a public filter either way
  // (reference data); status/pagination apply on top of the ownership scope,
  // never in place of it.
  async findAllForViewer(
    viewer: AuthenticatedUser,
    query: BreedRequestsQuery,
  ): Promise<Paginated<BreedRequest>> {
    const { page, limit, skip, take } = resolvePage(query);
    const where: FindOptionsWhere<BreedRequest> = {};
    if (query.status) where.status = query.status;
    if (query.speciesId) where.speciesId = query.speciesId;

    if (viewer.role === UserRole.ADMIN) {
      if (query.requestedByUserId)
        where.requestedByUserId = query.requestedByUserId;
    } else {
      where.requestedByUserId = viewer.id;
    }

    const [data, total] = await this.repository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take,
    });
    return { data, total, page, limit };
  }

  // Fetches a request and confirms `viewer` is the requester (or an admin).
  // Anyone else gets the exact same 404 a made-up id would return.
  async findOwned(
    id: string,
    viewer: AuthenticatedUser,
  ): Promise<BreedRequest> {
    const request = await this.findOne(id);
    if (
      viewer.role !== UserRole.ADMIN &&
      request.requestedByUserId !== viewer.id
    ) {
      throw new NotFoundException(`BreedRequest ${id} not found`);
    }
    return request;
  }

  // Same pattern as SpeciesRequests: approval creates the Breed row (under
  // the species the request was made against), links back to it, and
  // propagates the approval onto every listing already waiting on this breed.
  async review(
    id: string,
    input: { approve: boolean; reviewerId: string; reviewNote?: string },
  ): Promise<BreedRequest> {
    const request = await this.findOne(id);
    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException(`Request ${id} has already been reviewed`);
    }

    return this.dataSource.transaction(async (manager) => {
      const waitingListings = await manager
        .createQueryBuilder(Livestock, 'livestock')
        .where("JSON_UNQUOTE(JSON_EXTRACT(livestock.attributes, '$.breedRequestId')) = :requestId", {
          requestId: request.id,
        })
        .getMany();
      request.reviewedByUserId = input.reviewerId;
      request.reviewedAt = new Date();
      request.reviewNote = input.reviewNote ?? null;

      if (input.approve) {
        const breed = await manager.save(
          manager.create(Breed, {
            speciesId: request.speciesId,
            name: request.proposedName,
            slug: slugify(request.proposedName),
          }),
        );
        request.status = RequestStatus.APPROVED;
        request.createdBreedId = breed.id;
        await manager.update(
          Livestock,
          { breedId: breed.id },
          { breedApprovalStatus: RequestStatus.APPROVED },
        );
        for (const listing of waitingListings) {
          const attributes = listing.attributes ?? {};
          const originalStatus = String(attributes.originalStatus ?? '').toLowerCase();
          listing.breedId = breed.id;
          listing.breedApprovalStatus = RequestStatus.APPROVED;
          listing.attributes = {
            ...attributes,
            breed: request.proposedName,
            breedRequestId: '',
            breedApprovalStatus: 'Approved',
          };
          if (originalStatus === LivestockStatus.AVAILABLE) {
            listing.status = LivestockStatus.AVAILABLE;
            listing.marketplaceExpiresAt = new Date(Date.now() + LISTING_LIFETIME_MS);
          } else if (originalStatus === LivestockStatus.UNAVAILABLE) {
            listing.status = LivestockStatus.UNAVAILABLE;
          } else {
            listing.status = LivestockStatus.DRAFT;
          }
          await manager.save(listing);
        }
      } else {
        request.status = RequestStatus.REJECTED;
        for (const listing of waitingListings) {
          const attributes = listing.attributes ?? {};
          listing.breedId = null;
          listing.breedApprovalStatus = RequestStatus.REJECTED;
          listing.status = LivestockStatus.DRAFT;
          listing.marketplaceExpiresAt = null;
          listing.attributes = {
            ...attributes,
            breed: 'Unspecified',
            breedRequestId: '',
            breedApprovalStatus: 'Rejected',
          };
          await manager.save(listing);
        }
      }

      return manager.save(request);
    });
  }
}
