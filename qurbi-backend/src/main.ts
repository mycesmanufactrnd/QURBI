// Must load before anything else — modules like auth/jwt.constants.ts read
// process.env at import time (so they can fail loudly on boot), which is
// before Nest's own ConfigModule.forRoot() gets a chance to load .env.
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

async function bootstrap() {
  // CHIP signs the exact request bytes. Nest keeps them on req.rawBody so the
  // webhook can be verified before the parsed JSON payload is trusted.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  configureApp(app);
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
