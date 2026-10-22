import { MigrationInterface, QueryRunner } from "typeorm";

export class WifiNetworks1792630000000 implements MigrationInterface {
    name = 'WifiNetworks1792630000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "wifi_networks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "branchId" uuid NOT NULL, "ssid" character varying NOT NULL, "security" character varying NOT NULL, "hidden" boolean NOT NULL DEFAULT false, "imagePath" character varying NOT NULL, "isActive" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_wifi_networks_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_wifi_networks_branchId" ON "wifi_networks" ("branchId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_wifi_networks_active_per_branch" ON "wifi_networks" ("branchId") WHERE "isActive" = true`);
        await queryRunner.query(`ALTER TABLE "wifi_networks" ADD CONSTRAINT "FK_wifi_networks_branchId" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "wifi_networks" DROP CONSTRAINT "FK_wifi_networks_branchId"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_wifi_networks_active_per_branch"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_wifi_networks_branchId"`);
        await queryRunner.query(`DROP TABLE "wifi_networks"`);
    }
}
