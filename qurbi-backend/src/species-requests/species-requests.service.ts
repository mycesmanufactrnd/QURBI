import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequestStatus, Species, SpeciesRequest } from '../entities';
import { BaseCrudService } from '../common/base-crud.service';
import { slugify } from '../common/slugify';

@Injectable()
export class SpeciesRequestsService extends BaseCrudService<SpeciesRequest> {
  constructor(
    @InjectRepository(SpeciesRequest) repository: Repository<SpeciesRequest>,
    @InjectRepository(Species) private readonly speciesRepository: Repository<Species>,
  ) {
    super(repository);
  }

  findByUser(requestedByUserId: string): Promise<SpeciesRequest[]> {
    return this.repository.find({
      where: { requestedByUserId },
      order: { createdAt: 'DESC' },
    });
  }

  // Approval is the one place a Species row gets created from a request, and
  // links back to it via createdSpeciesId so the farmer can see what came of it.
  async review(
    id: string,
    input: { approve: boolean; reviewedByUserId: string; reviewNote?: string },
  ): Promise<SpeciesRequest> {
    const request = await this.findOne(id);
    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException(`Request ${id} has already been reviewed`);
    }

    request.reviewedByUserId = input.reviewedByUserId;
    request.reviewedAt = new Date();
    request.reviewNote = input.reviewNote ?? null;

    if (input.approve) {
      const species = await this.speciesRepository.save(
        this.speciesRepository.create({ name: request.proposedName, slug: slugify(request.proposedName) }),
      );
      request.status = RequestStatus.APPROVED;
      request.createdSpeciesId = species.id;
    } else {
      request.status = RequestStatus.REJECTED;
    }

    return this.repository.save(request);
  }
}
