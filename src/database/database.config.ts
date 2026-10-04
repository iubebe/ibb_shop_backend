import type { DataSourceOptions } from 'typeorm';
import { entities } from './entities/index.js';

type Env = Record<string, string | undefined>;

/**
 * Shared by the Nest `DatabaseModule` and the TypeORM CLI `data-source.ts`.
 *
 * Env: DB_HOST (localhost), DB_PORT (5432), DB_USER (ibb), DB_PASSWORD,
 * DB_NAME (ibb), DB_LOGGING (false), DB_MIGRATIONS_RUN (false)
 */
export function buildDatabaseOptions(env: Env): DataSourceOptions {
  return {
    type: 'postgres',
    host: env.DB_HOST ?? 'localhost',
    port: Number(env.DB_PORT ?? 5432),
    username: env.DB_USER ?? 'ibb',
    password: env.DB_PASSWORD,
    database: env.DB_NAME ?? 'ibb',
    entities,
    migrations: [`${import.meta.dirname}/migrations/*.{js,ts}`],
    // Schema changes go through migrations only.
    synchronize: false,
    migrationsRun: env.DB_MIGRATIONS_RUN === 'true',
    logging: env.DB_LOGGING === 'true' ? true : ['error', 'warn', 'migration'],
  };
}
