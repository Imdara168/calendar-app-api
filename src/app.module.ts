import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { DocumentsModule } from './documents/documents.module';
import { EventsModule } from './events/events.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql' as const,
        host: configService.get<string>('DB_HOST') ?? '127.0.0.1',
        port: Number(configService.get<string>('DB_PORT') ?? '3306'),
        username: configService.get<string>('DB_USERNAME') ?? 'root',
        password: configService.get<string>('DB_PASSWORD') ?? '',
        database: configService.get<string>('DB_NAME') ?? 'calendar-app',
        autoLoadEntities: true,
        synchronize: true,
        charset: 'utf8mb4',
        collation: 'utf8mb4_general_ci',
      }),
    }),
    AuthModule,
    DocumentsModule,
    EventsModule,
    ReportsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
