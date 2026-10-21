import { MigrationInterface, QueryRunner } from "typeorm";

export class Customers1792546244494 implements MigrationInterface {
    name = 'Customers1792546244494'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "customers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "branchId" uuid NOT NULL, "name" character varying, "phone" character varying, "address" character varying, CONSTRAINT "PK_133ec679a801fab5e070f73d3ea" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_48e2e935a344d55d2e0d7ea069" ON "customers"  ("branchId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_45f3cf689a2728f37c909ee395" ON "customers"  ("branchId", "phone") WHERE "phone" IS NOT NULL`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "customerId" uuid`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "customerName" character varying`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "customerPhone" character varying`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "customerAddress" character varying`);
        await queryRunner.query(`CREATE INDEX "IDX_e5de51ca888d8b1f5ac25799dd" ON "orders"  ("customerId") `);
        await queryRunner.query(`ALTER TABLE "customers" ADD CONSTRAINT "FK_48e2e935a344d55d2e0d7ea0699" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "FK_e5de51ca888d8b1f5ac25799dd1" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_e5de51ca888d8b1f5ac25799dd1"`);
        await queryRunner.query(`ALTER TABLE "customers" DROP CONSTRAINT "FK_48e2e935a344d55d2e0d7ea0699"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e5de51ca888d8b1f5ac25799dd"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "customerAddress"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "customerPhone"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "customerName"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "customerId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_45f3cf689a2728f37c909ee395"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_48e2e935a344d55d2e0d7ea069"`);
        await queryRunner.query(`DROP TABLE "customers"`);
    }
}
