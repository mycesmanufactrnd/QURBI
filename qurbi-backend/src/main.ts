// Must load before anything else — modules like auth/jwt.constants.ts read
// process.env at import time (so they can fail loudly on boot), which is
// before Nest's own ConfigModule.forRoot() gets a chance to load .env.
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  // Only uploads/public is statically served — private uploads (verification
  // IC/selfie/certificates) live in a sibling directory this middleware never
  // touches, so there's no path from here to them regardless of filename.
  // The only way to read a private upload is UploadsController's
  // authenticated GET /uploads/private/:id route (ownership/admin-checked).
  app.useStaticAssets(join(process.cwd(), 'uploads', 'public'), { prefix: '/uploads/public/' });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
