import { MigrationInterface, QueryRunner } from "typeorm";

export class OrderIndexes1793000000000 implements MigrationInterface {
    name = 'OrderIndexes1793000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_orders_branch_createdAt" ON "orders" ("branchId", "createdAt")`);
        await queryRunner.query(`CREATE INDEX "IDX_orders_branch_status_paidAt" ON "orders" ("branchId", "status", "paidAt")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_orders_branch_status_paidAt"`);
        await queryRunner.query(`DROP INDEX "IDX_orders_branch_createdAt"`);
    }
}
