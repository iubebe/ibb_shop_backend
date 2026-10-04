import { DataSource } from 'typeorm';
import { buildDatabaseOptions } from './database.config.js';

// TypeORM CLI entry (run against the build: `pnpm build` first). Load `.env`
// like Nest does; real environment variables win.
try {
  process.loadEnvFile();
} catch {
  // no .env file
}

export default new DataSource(buildDatabaseOptions(process.env));
