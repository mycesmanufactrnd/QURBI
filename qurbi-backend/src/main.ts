// Must load before anything else — modules like auth/jwt.constants.ts read
// process.env at import time (so they can fail loudly on boot), which is
// before Nest's own ConfigModule.forRoot() gets a chance to load .env.
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
