import { MigrationInterface, QueryRunner } from "typeorm";

export class ImportReceiptApproval1792400000000 implements MigrationInterface {
    name = 'ImportReceiptApproval1792400000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."import_receipts_status_enum" AS ENUM('pending', 'confirmed', 'rejected')`);
        await queryRunner.query(`ALTER TABLE "import_receipts" ADD "status" "public"."import_receipts_status_enum" NOT NULL DEFAULT 'confirmed'`);
        await queryRunner.query(`ALTER TABLE "import_receipts" ADD "imageKey" character varying`);
        await queryRunner.query(`ALTER TABLE "import_receipts" ADD "rejectReason" character varying`);
        await queryRunner.query(`ALTER TABLE "import_receipts" ADD "reviewedByUserId" uuid`);
        await queryRunner.query(`ALTER TABLE "import_receipts" ADD "reviewedAt" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "import_receipts" DROP COLUMN "reviewedAt"`);
        await queryRunner.query(`ALTER TABLE "import_receipts" DROP COLUMN "reviewedByUserId"`);
        await queryRunner.query(`ALTER TABLE "import_receipts" DROP COLUMN "rejectReason"`);
        await queryRunner.query(`ALTER TABLE "import_receipts" DROP COLUMN "imageKey"`);
        await queryRunner.query(`ALTER TABLE "import_receipts" DROP COLUMN "status"`);
        await queryRunner.query(`DROP TYPE "public"."import_receipts_status_enum"`);
    }
}
