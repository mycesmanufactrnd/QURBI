import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

export function configureApp(app: NestExpressApplication): void {
  const apiPrefix = process.env.API_PREFIX || 'api';
  const allowedOrigins = (
    process.env.FRONTEND_ORIGINS ||
    'http://localhost:5173,http://localhost:5174,http://localhost:5137'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.setGlobalPrefix(apiPrefix);
  app.enableCors({ origin: allowedOrigins, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useStaticAssets(join(process.cwd(), 'uploads', 'public'), {
    prefix: '/uploads/public/',
  });
}
