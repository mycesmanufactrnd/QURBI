import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { ALL_ENTITIES, Breed, Species } from '../src/entities';

const referenceData = [
  {
    name: 'Cow',
    slug: 'cow',
    maxShares: 7,
    breeds: [
      'Kedah-Kelantan (KK)',
      'Brahman',
      'Droughtmaster',
      'Mafriwal',
      'Local Indian Dairy (LID)',
      'Australian Commercial Cross',
      'Charolais',
      'Simmental',
      'Limousin',
      'Jersey',
      'Holstein Friesian',
      'Crossbreed',
    ],
  },
  {
    name: 'Goat',
    slug: 'goat',
    maxShares: 1,
    breeds: [
      'Katjang',
      'Boer',
      'Jamnapari',
      'Jermasia',
      'Kalahari Red',
      'Saanen',
      'Alpine',
      'Anglo-Nubian',
      'Toggenburg',
      'Shami',
      'Crossbreed',
    ],
  },
] as const;

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

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function main(): Promise<void> {
  await dataSource.initialize();
  const speciesRepository = dataSource.getRepository(Species);
  const breedRepository = dataSource.getRepository(Breed);

  for (const [speciesIndex, definition] of referenceData.entries()) {
    let species = await speciesRepository.findOne({
      where: { slug: definition.slug },
    });
    if (!species) {
      species = await speciesRepository.save(
        speciesRepository.create({
          name: definition.name,
          slug: definition.slug,
          maxShares: definition.maxShares,
          isActive: true,
          displayOrder: speciesIndex,
        }),
      );
    }

    for (const [breedIndex, breedName] of definition.breeds.entries()) {
      const slug = slugify(breedName);
      const existing = await breedRepository.findOne({
        where: { speciesId: species.id, slug },
      });
      if (!existing) {
        await breedRepository.save(
          breedRepository.create({
            speciesId: species.id,
            name: breedName,
            slug,
            isActive: true,
            displayOrder: breedIndex,
          }),
        );
      }
    }
  }

  console.log('QURBI species and breed reference data is ready.');
  await dataSource.destroy();
}

main().catch(async (error: unknown) => {
  console.error('Reference-data seed failed:', error);
  if (dataSource.isInitialized) await dataSource.destroy();
  process.exit(1);
});
