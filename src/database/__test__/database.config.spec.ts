import { buildDatabaseOptions } from '../database.config.js';
import { entities } from '../entities/index.js';

describe('buildDatabaseOptions', () => {
  it('uses local defaults and never synchronizes the schema', () => {
    const options = buildDatabaseOptions({});
    expect(options).toMatchObject({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'ibb',
      database: 'ibb',
      synchronize: false,
      migrationsRun: false,
    });
    expect(options.entities).toBe(entities);
  });

  it('reads connection settings from env', () => {
    const options = buildDatabaseOptions({
      DB_HOST: 'postgres',
      DB_PORT: '6543',
      DB_USER: 'u',
      DB_PASSWORD: 'p',
      DB_NAME: 'n',
      DB_MIGRATIONS_RUN: 'true',
    });
    expect(options).toMatchObject({
      host: 'postgres',
      port: 6543,
      username: 'u',
      password: 'p',
      database: 'n',
      migrationsRun: true,
    });
  });
});
