import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { TasksService } from "./TaskScheduling/task.service";
import { ScheduleModule } from "@nestjs/schedule";
// import { encryptResponseInterceptor } from "./interceptors/encryptres.interceptor";
// import { DecryptPayloadInterceptor } from "./interceptors/decrypt.interceptor";

// import { PIndicatorData } from "./entities/pindicatordata.entity";
// import { PIndicatorDataModule } from "./PIndicatorData/pindicatordata.module";
// import { JIareadate } from "./entities/ji_area_date.entity";
// import { JIScheduleWeek } from "./entities/cleaning_schedule_week.entity";

// app module akan connect to DB,  and sync.
// pp module define semua entity yang wujud.
import { GoogleDriveModule } from './google-drive/google-drive.module';
/*
  HOLD UP, looking and adding for modules/entities?
  use APP_MODULES and APP_ENTITIES instead
*/
import { APP_ENTITIES } from './app.entities';
import { APP_MODULES } from "./app.modules";
import { jwtConstants } from "./auth/jwt.constants";
import { StringValue } from "ms";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      name: "default",
      type: "mysql",
      // logger: new TypeOrmLogger(),
      // logging: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      // maxQueryExecutionTime: 1000, 
      host: process.env.DB_HOST,
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      synchronize: process.env.DB_SYNC == "true" ? true : false,
      autoLoadEntities: true,
      entities: APP_ENTITIES,
      // debug:true,
    }),
    JwtModule.register({
      secret: jwtConstants.secret,
      signOptions: {
        expiresIn: (process.env.DAY_TOKEN ? process.env.DAY_TOKEN : "7d") as StringValue,
      },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: parseInt(process.env.MINIT ? process.env.MINIT : "60000"),
        limit: parseInt(process.env.LIMIT ? process.env.LIMIT : "10"),
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
    AppService,
    TasksService,
  ],
  exports: [
    AppService,
  ],
})
export class AppModule {}
