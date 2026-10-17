import { MigrationInterface, QueryRunner } from "typeorm";

export class Finance1792300000000 implements MigrationInterface {
    name = 'Finance1792300000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "hourlyRate" numeric(12,2)`);
        await queryRunner.query(`CREATE TYPE "public"."expenses_category_enum" AS ENUM('rent', 'electricity', 'water', 'internet', 'gas', 'maintenance', 'marketing', 'other')`);
        await queryRunner.query(`CREATE TABLE "expenses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "branchId" uuid NOT NULL, "category" "public"."expenses_category_enum" NOT NULL, "amount" numeric(14,2) NOT NULL, "incurredOn" date NOT NULL, "note" character varying, "createdByUserId" uuid, CONSTRAINT "PK_expenses_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_expenses_branchId" ON "expenses" ("branchId")`);
        await queryRunner.query(`CREATE INDEX "IDX_expenses_incurredOn" ON "expenses" ("incurredOn")`);
        await queryRunner.query(`ALTER TABLE "expenses" ADD CONSTRAINT "FK_expenses_branchId" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "expenses" ADD CONSTRAINT "FK_expenses_createdByUserId" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "expenses" DROP CONSTRAINT "FK_expenses_createdByUserId"`);
        await queryRunner.query(`ALTER TABLE "expenses" DROP CONSTRAINT "FK_expenses_branchId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_expenses_incurredOn"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_expenses_branchId"`);
        await queryRunner.query(`DROP TABLE "expenses"`);
        await queryRunner.query(`DROP TYPE "public"."expenses_category_enum"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "hourlyRate"`);
    }
}
