import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildDatabaseOptions } from './database.config.js';

/**
 * Postgres via TypeORM. Import once in AppModule; use
 * `TypeOrmModule.forFeature([...])` in feature modules.
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        buildDatabaseOptions({
          DB_HOST: config.get<string>('DB_HOST'),
          DB_PORT: config.get<string>('DB_PORT'),
          DB_USER: config.get<string>('DB_USER'),
          DB_PASSWORD: config.get<string>('DB_PASSWORD'),
          DB_NAME: config.get<string>('DB_NAME'),
          DB_LOGGING: config.get<string>('DB_LOGGING'),
          DB_MIGRATIONS_RUN: config.get<string>('DB_MIGRATIONS_RUN'),
        }),
    }),
  ],
})
export class DatabaseModule {}
