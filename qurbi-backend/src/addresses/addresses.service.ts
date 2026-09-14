import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { Address } from '../entities';
import { BaseCrudService } from '../common/base-crud.service';

@Injectable()
export class AddressesService extends BaseCrudService<Address> {
  constructor(@InjectRepository(Address) repository: Repository<Address>) {
    super(repository);
  }

  findByUser(userId: string): Promise<Address[]> {
    return this.repository.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  // Only one address can be the default per user — creating/flagging one as
  // default must atomically un-flag any previous one.
  async create(data: DeepPartial<Address>): Promise<Address> {
    return this.repository.manager.transaction(async (manager) => {
      if (data.isDefault) {
        await manager.update(Address, { userId: data.userId }, { isDefault: false });
      }
      return manager.save(manager.create(Address, data));
    });
  }

  async update(id: string, data: DeepPartial<Address>): Promise<Address> {
    if (data.isDefault) {
      const address = await this.findOne(id);
      await this.repository.manager.transaction(async (manager) => {
        await manager.update(Address, { userId: address.userId }, { isDefault: false });
        await manager.update(Address, { id }, data);
      });
      return this.findOne(id);
    }
    return super.update(id, data);
  }

  async setDefault(userId: string, addressId: string): Promise<Address> {
    return this.repository.manager.transaction(async (manager) => {
      await manager.update(Address, { userId }, { isDefault: false });
      await manager.update(Address, { id: addressId }, { isDefault: true });
      return manager.findOneByOrFail(Address, { id: addressId });
    });
  }
}
