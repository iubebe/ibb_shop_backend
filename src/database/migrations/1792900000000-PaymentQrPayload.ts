import { MigrationInterface, QueryRunner } from "typeorm";

export class PaymentQrPayload1792900000000 implements MigrationInterface {
    name = 'PaymentQrPayload1792900000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payment_qr_codes" ADD "qrPayload" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payment_qr_codes" DROP COLUMN "qrPayload"`);
    }
}
