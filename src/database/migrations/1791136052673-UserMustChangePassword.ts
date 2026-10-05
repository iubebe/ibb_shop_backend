import { MigrationInterface, QueryRunner } from "typeorm";

export class UserMustChangePassword1791136052673 implements MigrationInterface {
    name = 'UserMustChangePassword1791136052673'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "mustChangePassword" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "mustChangePassword"`);
    }

}
