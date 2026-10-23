import { MigrationInterface, QueryRunner } from "typeorm";

export class Investments1792800000000 implements MigrationInterface {
    name = 'Investments1792800000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."investments_category_enum" AS ENUM('renovation', 'equipment', 'furniture', 'technology', 'deposit', 'other')`);
        await queryRunner.query(`CREATE TABLE "investments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "branchId" uuid NOT NULL, "name" character varying NOT NULL, "category" "public"."investments_category_enum" NOT NULL, "amount" numeric(14,2) NOT NULL, "investedOn" date NOT NULL, "note" character varying, "createdByUserId" uuid, CONSTRAINT "PK_investments_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_investments_branchId" ON "investments" ("branchId")`);
        await queryRunner.query(`CREATE INDEX "IDX_investments_investedOn" ON "investments" ("investedOn")`);
        await queryRunner.query(`ALTER TABLE "investments" ADD CONSTRAINT "FK_investments_branchId" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "investments" ADD CONSTRAINT "FK_investments_createdByUserId" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "investments" DROP CONSTRAINT "FK_investments_createdByUserId"`);
        await queryRunner.query(`ALTER TABLE "investments" DROP CONSTRAINT "FK_investments_branchId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_investments_investedOn"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_investments_branchId"`);
        await queryRunner.query(`DROP TABLE "investments"`);
        await queryRunner.query(`DROP TYPE "public"."investments_category_enum"`);
    }
}
