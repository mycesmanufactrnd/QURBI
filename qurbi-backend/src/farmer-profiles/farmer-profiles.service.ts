import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { FarmerProfile } from '../entities';
import { BaseCrudService } from '../common/base-crud.service';

@Injectable()
export class FarmerProfilesService extends BaseCrudService<FarmerProfile> {
  constructor(@InjectRepository(FarmerProfile) repository: Repository<FarmerProfile>) {
    super(repository);
  }

  findByUserId(userId: string): Promise<FarmerProfile | null> {
    return this.repository.findOne({ where: { userId } });
  }

  // One profile per user — created the moment a buyer becomes a farmer.
  async create(data: DeepPartial<FarmerProfile>): Promise<FarmerProfile> {
    const existing = await this.findByUserId(data.userId as string);
    if (existing) {
      throw new ConflictException(`User ${data.userId} already has a farmer profile`);
    }
    return super.create(data);
  }
}
