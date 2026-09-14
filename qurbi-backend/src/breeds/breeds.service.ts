import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Breed } from '../entities';
import { BaseCrudService } from '../common/base-crud.service';

@Injectable()
export class BreedsService extends BaseCrudService<Breed> {
  constructor(@InjectRepository(Breed) repository: Repository<Breed>) {
    super(repository);
  }

  findBySpecies(speciesId: string): Promise<Breed[]> {
    return this.repository.find({ where: { speciesId } });
  }
}
