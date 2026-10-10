import { MigrationInterface, QueryRunner } from "typeorm";

export class StaffSchedules1791277200000 implements MigrationInterface {
    name = 'StaffSchedules1791277200000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "staff_schedules" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "branchId" uuid NOT NULL, "assignedToUserId" uuid, "weekStartDate" date NOT NULL, "dayOfWeek" integer NOT NULL, "startTime" character varying(5) NOT NULL, "endTime" character varying(5) NOT NULL, "shiftType" character varying(50), "position" character varying(100), "status" character varying NOT NULL DEFAULT 'scheduled', CONSTRAINT "PK_74f33484f8e8e3b8fa96fd5e5dd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_9e8e3f8b8c1e3a4b5c6d7e8f9a" ON "staff_schedules"  ("branchId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a1b2c3d4e5f6g7h8i9j0k1l2m3" ON "staff_schedules"  ("weekStartDate") `);
        await queryRunner.query(`CREATE TABLE "staff_shift_registrations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "scheduleId" uuid NOT NULL, "staffUserId" uuid NOT NULL, "status" character varying(50) NOT NULL DEFAULT 'pending', "adminNotes" text, "reviewedAt" TIMESTAMP WITH TIME ZONE, "reviewedByUserId" uuid, CONSTRAINT "PK_n4o5p6q7r8s9t0u1v2w3x4y5z6a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_b1c2d3e4f5g6h7i8j9k0l1m2n3" ON "staff_shift_registrations"  ("scheduleId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c2d3e4f5g6h7i8j9k0l1m2n3o4" ON "staff_shift_registrations"  ("status") `);
        await queryRunner.query(`ALTER TABLE "staff_schedules" ADD CONSTRAINT "FK_d3e4f5g6h7i8j9k0l1m2n3o4p5" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "staff_schedules" ADD CONSTRAINT "FK_e4f5g6h7i8j9k0l1m2n3o4p5q6" FOREIGN KEY ("assignedToUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "staff_shift_registrations" ADD CONSTRAINT "FK_f5g6h7i8j9k0l1m2n3o4p5q6r7" FOREIGN KEY ("scheduleId") REFERENCES "staff_schedules"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "staff_shift_registrations" ADD CONSTRAINT "FK_g6h7i8j9k0l1m2n3o4p5q6r7s8" FOREIGN KEY ("staffUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "staff_shift_registrations" ADD CONSTRAINT "FK_h7i8j9k0l1m2n3o4p5q6r7s8t9" FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "staff_shift_registrations" DROP CONSTRAINT "FK_h7i8j9k0l1m2n3o4p5q6r7s8t9"`);
        await queryRunner.query(`ALTER TABLE "staff_shift_registrations" DROP CONSTRAINT "FK_g6h7i8j9k0l1m2n3o4p5q6r7s8"`);
        await queryRunner.query(`ALTER TABLE "staff_shift_registrations" DROP CONSTRAINT "FK_f5g6h7i8j9k0l1m2n3o4p5q6r7"`);
        await queryRunner.query(`ALTER TABLE "staff_schedules" DROP CONSTRAINT "FK_e4f5g6h7i8j9k0l1m2n3o4p5q6"`);
        await queryRunner.query(`ALTER TABLE "staff_schedules" DROP CONSTRAINT "FK_d3e4f5g6h7i8j9k0l1m2n3o4p5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c2d3e4f5g6h7i8j9k0l1m2n3o4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b1c2d3e4f5g6h7i8j9k0l1m2n3"`);
        await queryRunner.query(`DROP TABLE "staff_shift_registrations"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a1b2c3d4e5f6g7h8i9j0k1l2m3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9e8e3f8b8c1e3a4b5c6d7e8f9a"`);
        await queryRunner.query(`DROP TABLE "staff_schedules"`);
    }

}
