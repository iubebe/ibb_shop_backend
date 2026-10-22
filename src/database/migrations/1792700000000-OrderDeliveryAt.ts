import { MigrationInterface, QueryRunner } from "typeorm";

export class OrderDeliveryAt1792700000000 implements MigrationInterface {
    name = 'OrderDeliveryAt1792700000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "orders" ADD "deliveryAt" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "deliveryAt"`);
    }
}
