import { MigrationInterface, QueryRunner } from "typeorm";

export class FinanceForecasts1792310000000 implements MigrationInterface {
    name = 'FinanceForecasts1792310000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "finance_forecasts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "branchId" uuid NOT NULL, "generatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "modelName" character varying(60) NOT NULL, "modelVersion" character varying(40) NOT NULL, "dataThrough" date NOT NULL, "horizonDays" integer NOT NULL, "payload" jsonb NOT NULL, CONSTRAINT "PK_finance_forecasts_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_finance_forecasts_branch_generated" ON "finance_forecasts" ("branchId", "generatedAt")`);
        await queryRunner.query(`ALTER TABLE "finance_forecasts" ADD CONSTRAINT "FK_finance_forecasts_branchId" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "finance_forecasts" DROP CONSTRAINT "FK_finance_forecasts_branchId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_finance_forecasts_branch_generated"`);
        await queryRunner.query(`DROP TABLE "finance_forecasts"`);
    }
}
