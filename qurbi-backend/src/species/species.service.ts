import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Species } from '../entities';
import { BaseCrudService } from '../common/base-crud.service';

@Injectable()
export class SpeciesService extends BaseCrudService<Species> {
  constructor(@InjectRepository(Species) repository: Repository<Species>) {
    super(repository);
  }
}
