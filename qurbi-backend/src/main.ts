import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const apiPrefix = process.env.API_PREFIX || 'api';
  const origins = (
    process.env.FRONTEND_ORIGINS ||
    'http://localhost:5173,http://localhost:5174'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.setGlobalPrefix(apiPrefix);
  app.enableCors({ origin: origins, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
