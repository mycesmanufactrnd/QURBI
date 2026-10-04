import 'reflect-metadata';
import 'dotenv/config';
import * as argon2 from 'argon2';
import { DataSource } from 'typeorm';
import { ALL_ENTITIES, User, UserRole, UserStatus } from '../src/entities';

// Creates one login per role (buyer, farmer, admin) for local development.
// Usage: npm run seed:demo-users
// Safe to re-run: existing emails get their role/status/password reset.

const DEMO_USERS = [
  {
    email: 'buyer@qurbi.local',
    password: 'ChangeMe123!',
    fullName: 'Demo Buyer',
    role: UserRole.BUYER,
  },
  {
    email: 'farmer@qurbi.local',
    password: 'ChangeMe123!',
    fullName: 'Demo Farmer',
    role: UserRole.FARMER,
  },
  {
    email: 'admin@qurbi.local',
    password: 'ChangeMe123!',
    fullName: 'QURBI Admin',
    role: UserRole.ADMIN,
  },
];

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
  const userRepository = dataSource.getRepository(User);

  for (const demo of DEMO_USERS) {
    const passwordHash = await argon2.hash(demo.password, {
      type: argon2.argon2id,
    });
    const existing = await userRepository.findOne({
      where: { email: demo.email },
    });

    if (existing) {
      existing.role = demo.role;
      existing.status = UserStatus.ACTIVE;
      existing.passwordHash = passwordHash;
      await userRepository.save(existing);
      console.log(`Updated ${demo.role}: ${demo.email}`);
    } else {
      await userRepository.save(
        userRepository.create({
          email: demo.email,
          passwordHash,
          fullName: demo.fullName,
          role: demo.role,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        }),
      );
      console.log(`Created ${demo.role}: ${demo.email}`);
    }
  }

  await dataSource.destroy();
}

main().catch(async (error: unknown) => {
  console.error('Demo user seed failed:', error);
  if (dataSource.isInitialized) await dataSource.destroy();
  process.exit(1);
});
