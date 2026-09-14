import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Breed, BreedRequest, RequestStatus } from '../entities';
import { BaseCrudService } from '../common/base-crud.service';
import { slugify } from '../common/slugify';

@Injectable()
export class BreedRequestsService extends BaseCrudService<BreedRequest> {
  constructor(
    @InjectRepository(BreedRequest) repository: Repository<BreedRequest>,
    @InjectRepository(Breed) private readonly breedRepository: Repository<Breed>,
  ) {
    super(repository);
  }

  findByUser(requestedByUserId: string): Promise<BreedRequest[]> {
    return this.repository.find({
      where: { requestedByUserId },
      order: { createdAt: 'DESC' },
    });
  }

  findBySpecies(speciesId: string): Promise<BreedRequest[]> {
    return this.repository.find({ where: { speciesId }, order: { createdAt: 'DESC' } });
  }

  // Same pattern as SpeciesRequests: approval creates the Breed row (under
  // the species the request was made against) and links back to it.
  async review(
    id: string,
    input: { approve: boolean; reviewedByUserId: string; reviewNote?: string },
  ): Promise<BreedRequest> {
    const request = await this.findOne(id);
    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException(`Request ${id} has already been reviewed`);
    }

    request.reviewedByUserId = input.reviewedByUserId;
    request.reviewedAt = new Date();
    request.reviewNote = input.reviewNote ?? null;

    if (input.approve) {
      const breed = await this.breedRepository.save(
        this.breedRepository.create({
          speciesId: request.speciesId,
          name: request.proposedName,
          slug: slugify(request.proposedName),
        }),
      );
      request.status = RequestStatus.APPROVED;
      request.createdBreedId = breed.id;
    } else {
      request.status = RequestStatus.REJECTED;
    }

    return this.repository.save(request);
  }
}
