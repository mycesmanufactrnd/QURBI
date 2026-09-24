import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { ALL_ENTITIES } from '../src/entities';

// Same connection config app.module.ts builds from .env — deliberately
// synchronize: false, since this script only proves TypeORM can build valid
// metadata for every entity/relation, not that it can write schema.
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

async function main() {
  await dataSource.initialize();

  for (const meta of dataSource.entityMetadatas) {
    console.log(`\n${meta.name}  (table: ${meta.tableName})`);

    console.log('  columns:');
    for (const column of meta.columns) {
      const sqlType = column.type instanceof Function ? column.type.name : column.type;
      const flags = [column.isPrimary && 'PK', column.isNullable && 'nullable']
        .filter(Boolean)
        .join(', ');
      console.log(`    - ${column.propertyName}: ${sqlType}${flags ? ` (${flags})` : ''}`);
    }

    if (meta.relations.length) {
      console.log('  relations:');
      for (const relation of meta.relations) {
        const target =
          typeof relation.type === 'function' ? relation.type.name : String(relation.type);
        console.log(`    - ${relation.propertyName}: ${relation.relationType} -> ${target}`);
      }
    }
  }

  console.log(`\nTotal entities registered: ${dataSource.entityMetadatas.length}`);

  await dataSource.destroy();
}

main().catch(async (err) => {
  console.error('Entity validation FAILED:');
  console.error(err);
  if (dataSource.isInitialized) {
    await dataSource.destroy();
  }
  process.exit(1);
});
