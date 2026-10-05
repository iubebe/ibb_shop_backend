import { randomBytes } from 'node:crypto';
import { PasswordService } from '../auth/password.service.js';
import dataSource from './data-source.js';
import { Branch } from './entities/branch.entity.js';
import { User } from './entities/user.entity.js';
import { UserRole } from './enums.js';

/**
 * Idempotent seed (run with `pnpm db:seed`): default branch + first admin.
 * Never touches an existing admin, so re-running is safe.
 *
 * Env: SEED_BRANCH_NAME ("Main Branch"), SEED_ADMIN_EMAIL (required),
 * SEED_ADMIN_NAME ("Administrator"), SEED_ADMIN_PASSWORD (random if unset,
 * printed once). The admin must change the password at first login.
 */
async function seed() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) throw new Error('SEED_ADMIN_EMAIL is required');

  await dataSource.initialize();
  try {
    const branches = dataSource.getRepository(Branch);
    const users = dataSource.getRepository(User);

    const branchName = process.env.SEED_BRANCH_NAME || 'Main Branch';
    const branch =
      (await branches.findOneBy({ name: branchName })) ??
      (await branches.save(branches.create({ name: branchName })));

    const existing = await users
      .createQueryBuilder('user')
      .where('LOWER(user.email) = :email', { email })
      .getOne();
    if (existing) {
      console.log(`Admin ${email} already exists, nothing to do.`);
      return;
    }

    const provided = process.env.SEED_ADMIN_PASSWORD;
    const generated = !provided;
    const password = provided || randomBytes(15).toString('base64url');
    await users.save(
      users.create({
        branchId: branch.id,
        name: process.env.SEED_ADMIN_NAME || 'Administrator',
        email,
        passwordHash: await new PasswordService().hash(password),
        role: UserRole.ADMIN,
        mustChangePassword: true,
      }),
    );
    console.log(`Created admin ${email} in branch "${branch.name}".`);
    if (generated) console.log(`Temporary password (shown once): ${password}`);
    console.log('The password must be changed at first login.');
  } finally {
    await dataSource.destroy();
  }
}

await seed();
