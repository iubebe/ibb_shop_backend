import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Staff shift proposals: audit columns on staff_schedules. Existing rows keep
 * their status; `proposed` is just a new value of the existing varchar column.
 */
export class StaffShiftProposals1791654554824 implements MigrationInterface {
    name = 'StaffShiftProposals1791654554824'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "staff_schedules" ADD "proposedByUserId" uuid`);
        await queryRunner.query(`ALTER TABLE "staff_schedules" ADD "reviewedByUserId" uuid`);
        await queryRunner.query(`ALTER TABLE "staff_schedules" ADD "reviewedAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "staff_schedules" ADD "reviewNotes" text`);
        await queryRunner.query(`CREATE INDEX "IDX_cc75c31a155a0f2222868f1aff" ON "staff_schedules" ("proposedByUserId") `);
        await queryRunner.query(`ALTER TABLE "staff_schedules" ADD CONSTRAINT "FK_cc75c31a155a0f2222868f1aff7" FOREIGN KEY ("proposedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "staff_schedules" ADD CONSTRAINT "FK_030c427e32fbfdc3df2227ef63b" FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "staff_schedules" DROP CONSTRAINT "FK_030c427e32fbfdc3df2227ef63b"`);
        await queryRunner.query(`ALTER TABLE "staff_schedules" DROP CONSTRAINT "FK_cc75c31a155a0f2222868f1aff7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cc75c31a155a0f2222868f1aff"`);
        await queryRunner.query(`ALTER TABLE "staff_schedules" DROP COLUMN "reviewNotes"`);
        await queryRunner.query(`ALTER TABLE "staff_schedules" DROP COLUMN "reviewedAt"`);
        await queryRunner.query(`ALTER TABLE "staff_schedules" DROP COLUMN "reviewedByUserId"`);
        await queryRunner.query(`ALTER TABLE "staff_schedules" DROP COLUMN "proposedByUserId"`);
    }
}
