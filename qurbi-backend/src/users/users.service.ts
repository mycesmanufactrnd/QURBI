import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { DeepPartial, Repository } from 'typeorm';
import { User } from '../entities';
import { BaseCrudService } from '../common/base-crud.service';

const BCRYPT_SALT_ROUNDS = 10;

type CreateUserInput = DeepPartial<User> & { password?: string };
type UpdateUserInput = DeepPartial<User> & { password?: string };

@Injectable()
export class UsersService extends BaseCrudService<User> {
  constructor(@InjectRepository(User) repository: Repository<User>) {
    super(repository);
  }

  // passwordHash is `select: false` on the entity, so it never leaks through
  // findAll/findOne by default — only this explicit lookup (used by the auth
  // flow) opts back in.
  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.repository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();
  }

  async create(data: CreateUserInput): Promise<User> {
    const { password, ...rest } = data;
    const existing = await this.repository.findOne({
      where: { email: rest.email },
    });
    if (existing) {
      throw new ConflictException(`Email ${rest.email} is already registered`);
    }
    const passwordHash = password
      ? await bcrypt.hash(password, BCRYPT_SALT_ROUNDS)
      : null;
    const saved = await this.repository.save(
      this.repository.create({ ...rest, passwordHash }),
    );
    // select: false only hides passwordHash from queries, not from an entity
    // instance returned directly by save() — re-fetch so the response matches
    // every other read path and never echoes the hash back to the caller.
    return this.findOne(saved.id);
  }

  async update(id: string, data: UpdateUserInput): Promise<User> {
    const { password, ...rest } = data;
    const patch: DeepPartial<User> = { ...rest };
    if (password) {
      patch.passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    }
    return super.update(id, patch);
  }

  async verifyPassword(user: User, password: string): Promise<boolean> {
    if (!user.passwordHash) return false;
    return bcrypt.compare(password, user.passwordHash);
  }

  async recordLogin(id: string): Promise<void> {
    await this.repository.update(id, { lastLoginAt: new Date() });
  }
}
