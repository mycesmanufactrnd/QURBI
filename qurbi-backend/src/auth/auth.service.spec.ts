import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User, UserRole, UserStatus } from '../entities';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

jest.mock('../users/users.service', () => ({
  UsersService: class UsersService {},
}));

const buyer = {
  id: 'buyer-1',
  email: 'buyer@example.com',
  fullName: 'QURBI Buyer',
  role: UserRole.BUYER,
  status: UserStatus.ACTIVE,
} as User;

describe('AuthService', () => {
  const users = {
    create: jest.fn(),
    findByEmailWithPassword: jest.fn(),
    verifyPassword: jest.fn(),
    recordLogin: jest.fn(),
    findOne: jest.fn(),
  };
  const jwt = { signAsync: jest.fn().mockResolvedValue('signed-token') };
  const service = new AuthService(
    users as unknown as UsersService,
    jwt as unknown as JwtService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('normalizes a buyer registration and returns a JWT session', async () => {
    users.create.mockResolvedValue(buyer);

    const result = await service.register({
      email: ' Buyer@Example.com ',
      password: 'password123',
      fullName: ' QURBI Buyer ',
      role: UserRole.BUYER,
    });

    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'buyer@example.com',
        fullName: 'QURBI Buyer',
        role: UserRole.BUYER,
      }),
    );
    expect(result).toEqual({ accessToken: 'signed-token', user: buyer });
  });

  it('rejects an incorrect password without revealing which field failed', async () => {
    users.findByEmailWithPassword.mockResolvedValue(buyer);
    users.verifyPassword.mockResolvedValue(false);

    await expect(
      service.login({
        email: buyer.email,
        password: 'wrong-password',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
