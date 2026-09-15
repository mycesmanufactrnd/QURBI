import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TasksService } from './TaskScheduling/task.service';
import { ScheduleModule } from '@nestjs/schedule';
import { GoogleDriveModule } from './google-drive/google-drive.module';
/*
  HOLD UP, looking and adding for modules/entities?
  use APP_MODULES and APP_ENTITIES instead
*/
import { APP_ENTITIES } from './app.entities';
import { APP_MODULES } from './app.modules';
import { jwtConstants } from './auth/jwt.constants';
import { StringValue } from 'ms';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      name: 'default',
      type: 'mysql',
      // logger: new TypeOrmLogger(),
      // logging: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      // maxQueryExecutionTime: 1000,
      host: process.env.DB_HOST,
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      charset: 'utf8mb4',
      // DEV ONLY: synchronize auto-generates/alters tables from the entities on
      // every boot. Great for iterating on the schema now, but it can drop or
      // rewrite columns without warning — turn this off (use migrations
      // instead) before this ever points at a database with real data.
      synchronize: process.env.DB_SYNC === 'true',
      autoLoadEntities: true,
      entities: APP_ENTITIES,
      // debug:true,
    }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET') || jwtConstants.secret;
        if (!secret || secret.length < 32) {
          throw new Error('JWT_SECRET must contain at least 32 characters');
        }
        return {
          secret,
          signOptions: {
            expiresIn: (config.get<string>('JWT_EXPIRES_IN') ||
              '7d') as StringValue,
          },
        };
      },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: parseInt(process.env.THROTTLE_TTL_MS || '60000'),
        limit: parseInt(process.env.THROTTLE_LIMIT || '100'),
      },
    ]),
    ScheduleModule.forRoot(),
    GoogleDriveModule,
    ...APP_MODULES,
  ],
  controllers: [AppController],
  providers: [
    // {
    //   provide: APP_INTERCEPTOR,
    //   useClass: DecryptPayloadInterceptor,
    // },
    // {
    //   provide: APP_INTERCEPTOR,
    //   useClass: encryptResponseInterceptor,
    // },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    AppService,
    TasksService,
  ],
  exports: [AppService],
})
export class AppModule {}
