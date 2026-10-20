import 'reflect-metadata';
import 'dotenv/config';
import * as argon2 from 'argon2';
import { DataSource } from 'typeorm';
import {
  ALL_ENTITIES,
  CourierProfile,
  CourierVerificationStatus,
  User,
  UserRole,
  UserStatus,
} from '../src/entities';

// Creates an already-approved courier login for local development, so the
// courier flow can be tried without going through signup and admin review.
// Usage: npm run seed:demo-courier
// Safe to re-run: the existing account gets its password and approval reset.

const EMAIL = 'courier@qurbi.local';
const PASSWORD = 'ChangeMe123!';

const dataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  charset: 'utf8mb4',
  synchronize: false,
  entities: ALL_ENTITIES,
});

async function main(): Promise<void> {
  await dataSource.initialize();
  const users = dataSource.getRepository(User);
  const profiles = dataSource.getRepository(CourierProfile);

  const passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
  let user = await users.findOne({ where: { email: EMAIL } });
  if (user) {
    user.role = UserRole.COURIER;
    user.status = UserStatus.ACTIVE;
    user.passwordHash = passwordHash;
  } else {
    user = users.create({
      email: EMAIL,
      passwordHash,
      fullName: 'Demo Courier',
      role: UserRole.COURIER,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    });
  }
  user = await users.save(user);

  const profile =
    (await profiles.findOne({ where: { userId: user.id } })) ??
    profiles.create({ userId: user.id });
  Object.assign(profile, {
    icNumber: '900101-14-5678',
    vehicleType: 'Pickup truck',
    vehiclePlate: 'QRB 1234',
    serviceAreas: [{ state: 'Selangor' }, { state: 'Kuala Lumpur' }],
    verificationStatus: CourierVerificationStatus.APPROVED,
    suspensionReason: null,
  });
  await profiles.save(profile);

  console.log(`Ready: ${EMAIL} (approved courier)`);
  await dataSource.destroy();
}

main().catch(async (error: unknown) => {
  console.error('Demo courier seed failed:', error);
  if (dataSource.isInitialized) await dataSource.destroy();
  process.exit(1);
});
