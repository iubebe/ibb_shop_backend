import { MigrationInterface, QueryRunner } from "typeorm";

export class AttendanceRecords1791214134791 implements MigrationInterface {
    name = 'AttendanceRecords1791214134791'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."attendance_records_checkinfacestatus_enum" AS ENUM('pending', 'passed', 'failed')`);
        await queryRunner.query(`CREATE TYPE "public"."attendance_records_checkoutfacestatus_enum" AS ENUM('pending', 'passed', 'failed')`);
        await queryRunner.query(`CREATE TABLE "attendance_records" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "branchId" uuid NOT NULL, "userId" uuid NOT NULL, "checkInAt" TIMESTAMP WITH TIME ZONE NOT NULL, "checkInPhotoKey" character varying NOT NULL, "checkInFaceStatus" "public"."attendance_records_checkinfacestatus_enum" NOT NULL DEFAULT 'pending', "checkOutAt" TIMESTAMP WITH TIME ZONE, "checkOutPhotoKey" character varying, "checkOutFaceStatus" "public"."attendance_records_checkoutfacestatus_enum" NOT NULL DEFAULT 'pending', "adjustedAt" TIMESTAMP WITH TIME ZONE, "adjustedByUserId" uuid, CONSTRAINT "PK_946920332f5bc9efad3f3023b96" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_13dafb1762d6860ba7622dcb49" ON "attendance_records"  ("userId", "checkInAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_bc2e7ffc8b29d989403f0cdc83" ON "attendance_records"  ("branchId", "checkInAt") `);
        await queryRunner.query(`ALTER TABLE "users" ADD "isActive" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "attendance_records" ADD CONSTRAINT "FK_1e54e65dc1807c1c1103426643e" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "attendance_records" ADD CONSTRAINT "FK_3e24aad29f272e2606de0462420" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "attendance_records" DROP CONSTRAINT "FK_3e24aad29f272e2606de0462420"`);
        await queryRunner.query(`ALTER TABLE "attendance_records" DROP CONSTRAINT "FK_1e54e65dc1807c1c1103426643e"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "isActive"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bc2e7ffc8b29d989403f0cdc83"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_13dafb1762d6860ba7622dcb49"`);
        await queryRunner.query(`DROP TABLE "attendance_records"`);
        await queryRunner.query(`DROP TYPE "public"."attendance_records_checkoutfacestatus_enum"`);
        await queryRunner.query(`DROP TYPE "public"."attendance_records_checkinfacestatus_enum"`);
    }

}
