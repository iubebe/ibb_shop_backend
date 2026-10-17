import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Payment QR images: convert imagePath from public S3 URL to S3 key.
 * Images are now served via private authenticated endpoint GET /payment-qr-codes/:id/image
 */
export class PaymentQrPrivateImages1791655200000 implements MigrationInterface {
    name = 'PaymentQrPrivateImages1791655200000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Convert existing public URLs to S3 keys
        // URLs are in format: http://localhost:9000/ibb-media/payment-qr/branchId/uuid.ext
        // or similar. We extract the path after the domain.
        await queryRunner.query(`
            UPDATE "payment_qr_codes"
            SET "imagePath" = SUBSTRING("imagePath" FROM POSITION('/' || 'payment-qr' IN "imagePath"))
            WHERE "imagePath" LIKE '%payment-qr%'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Cannot reliably reverse this migration as we've lost the original endpoint/base URL info
        // Manual restoration would be required
    }
}
