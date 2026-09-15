import 'dotenv/config';
import { DataSource } from 'typeorm';
import { ALL_ENTITIES } from '../entities';

export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'qurbidb',
  charset: 'utf8mb4',
  entities: ALL_ENTITIES,
  migrations: ['src/database/migrations/*{.ts,.js}'],
  synchronize: false,
});
