import { MigrationInterface, QueryRunner } from "typeorm";

export class OrderItemServedQuantity1791200000000 implements MigrationInterface {
    name = 'OrderItemServedQuantity1791200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "order_items" ADD "servedQuantity" integer NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "order_items" ADD CONSTRAINT "CHK_order_items_served_quantity" CHECK ("servedQuantity" >= 0 AND "servedQuantity" <= "quantity")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "order_items" DROP CONSTRAINT "CHK_order_items_served_quantity"`);
        await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN "servedQuantity"`);
    }

}
