import { MigrationInterface, QueryRunner } from "typeorm";

export class StockImports1792227058378 implements MigrationInterface {
    name = 'StockImports1792227058378'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "suppliers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "branchId" uuid NOT NULL, "name" character varying NOT NULL, "phone" character varying, "note" character varying, CONSTRAINT "PK_b70ac51766a9e3144f778cfe81e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_73b60b22f5ec246f8416c9b721" ON "suppliers"  ("branchId") `);
        await queryRunner.query(`CREATE TABLE "import_receipts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "branchId" uuid NOT NULL, "code" character varying(30) NOT NULL, "supplierId" uuid, "importedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "note" character varying, "totalCost" numeric(14,2) NOT NULL, "createdByUserId" uuid, CONSTRAINT "PK_1a42ada05039c7b7343ba4399a7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_59d44f149095f6e875b91f0ac9" ON "import_receipts"  ("branchId") `);
        await queryRunner.query(`CREATE INDEX "IDX_fefb537fce8ad87a6651e875e2" ON "import_receipts"  ("importedAt") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_292611e2a9c08cdbbad527d0a8" ON "import_receipts"  ("branchId", "code") `);
        await queryRunner.query(`CREATE TYPE "public"."stock_items_kind_enum" AS ENUM('goods', 'material')`);
        await queryRunner.query(`CREATE TABLE "stock_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "branchId" uuid NOT NULL, "name" character varying NOT NULL, "kind" "public"."stock_items_kind_enum" NOT NULL, "unit" character varying(30) NOT NULL, "quantity" numeric(14,3) NOT NULL DEFAULT '0', "lowStockThreshold" numeric(14,3) NOT NULL DEFAULT '0', "lastUnitCost" numeric(14,2), "isActive" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_52a266aa3e04b8ad1f01088f3f0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_b3d4d07aa687b43a2b6bbd7a38" ON "stock_items"  ("branchId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_3d1d392e98338a358f048d2b11" ON "stock_items"  ("branchId", "name") `);
        await queryRunner.query(`CREATE TABLE "import_receipt_lines" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "receiptId" uuid NOT NULL, "stockItemId" uuid NOT NULL, "quantity" numeric(14,3) NOT NULL, "unitCost" numeric(14,2) NOT NULL, CONSTRAINT "PK_c16a171dc5eb4c601b89ddcef00" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_5f5151ab588e2d2058b9f41003" ON "import_receipt_lines"  ("receiptId") `);
        await queryRunner.query(`CREATE INDEX "IDX_774acd7cf9e13ec0b7e87f4ced" ON "import_receipt_lines"  ("stockItemId") `);
        await queryRunner.query(`CREATE TYPE "public"."stock_item_movements_reason_enum" AS ENUM('import', 'adjustment')`);
        await queryRunner.query(`CREATE TABLE "stock_item_movements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "stockItemId" uuid NOT NULL, "change" numeric(14,3) NOT NULL, "quantityAfter" numeric(14,3) NOT NULL, "reason" "public"."stock_item_movements_reason_enum" NOT NULL, "receiptId" uuid, "note" character varying, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "createdByUserId" uuid, CONSTRAINT "PK_e2705a62d408e512e0b929d4dfd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_f8fecd478bf7771767309728ba" ON "stock_item_movements"  ("stockItemId") `);
        await queryRunner.query(`CREATE INDEX "IDX_2ddad7b7fd6ff04fdd92590ffa" ON "stock_item_movements"  ("createdAt") `);
        await queryRunner.query(`ALTER TABLE "suppliers" ADD CONSTRAINT "FK_73b60b22f5ec246f8416c9b7211" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "import_receipts" ADD CONSTRAINT "FK_59d44f149095f6e875b91f0ac9d" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "import_receipts" ADD CONSTRAINT "FK_b4e023e4a7236b1d5f87d6a9784" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "import_receipts" ADD CONSTRAINT "FK_a66b87b9854947508a2eee11854" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "stock_items" ADD CONSTRAINT "FK_b3d4d07aa687b43a2b6bbd7a38e" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "import_receipt_lines" ADD CONSTRAINT "FK_5f5151ab588e2d2058b9f41003c" FOREIGN KEY ("receiptId") REFERENCES "import_receipts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "import_receipt_lines" ADD CONSTRAINT "FK_774acd7cf9e13ec0b7e87f4cedd" FOREIGN KEY ("stockItemId") REFERENCES "stock_items"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "stock_item_movements" ADD CONSTRAINT "FK_f8fecd478bf7771767309728bac" FOREIGN KEY ("stockItemId") REFERENCES "stock_items"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "stock_item_movements" ADD CONSTRAINT "FK_6a0cf9222bf15394e70f6837249" FOREIGN KEY ("receiptId") REFERENCES "import_receipts"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "stock_item_movements" ADD CONSTRAINT "FK_fb8bf498b66f7ef691071417a6a" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "stock_item_movements" DROP CONSTRAINT "FK_fb8bf498b66f7ef691071417a6a"`);
        await queryRunner.query(`ALTER TABLE "stock_item_movements" DROP CONSTRAINT "FK_6a0cf9222bf15394e70f6837249"`);
        await queryRunner.query(`ALTER TABLE "stock_item_movements" DROP CONSTRAINT "FK_f8fecd478bf7771767309728bac"`);
        await queryRunner.query(`ALTER TABLE "import_receipt_lines" DROP CONSTRAINT "FK_774acd7cf9e13ec0b7e87f4cedd"`);
        await queryRunner.query(`ALTER TABLE "import_receipt_lines" DROP CONSTRAINT "FK_5f5151ab588e2d2058b9f41003c"`);
        await queryRunner.query(`ALTER TABLE "stock_items" DROP CONSTRAINT "FK_b3d4d07aa687b43a2b6bbd7a38e"`);
        await queryRunner.query(`ALTER TABLE "import_receipts" DROP CONSTRAINT "FK_a66b87b9854947508a2eee11854"`);
        await queryRunner.query(`ALTER TABLE "import_receipts" DROP CONSTRAINT "FK_b4e023e4a7236b1d5f87d6a9784"`);
        await queryRunner.query(`ALTER TABLE "import_receipts" DROP CONSTRAINT "FK_59d44f149095f6e875b91f0ac9d"`);
        await queryRunner.query(`ALTER TABLE "suppliers" DROP CONSTRAINT "FK_73b60b22f5ec246f8416c9b7211"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2ddad7b7fd6ff04fdd92590ffa"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f8fecd478bf7771767309728ba"`);
        await queryRunner.query(`DROP TABLE "stock_item_movements"`);
        await queryRunner.query(`DROP TYPE "public"."stock_item_movements_reason_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_774acd7cf9e13ec0b7e87f4ced"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5f5151ab588e2d2058b9f41003"`);
        await queryRunner.query(`DROP TABLE "import_receipt_lines"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3d1d392e98338a358f048d2b11"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b3d4d07aa687b43a2b6bbd7a38"`);
        await queryRunner.query(`DROP TABLE "stock_items"`);
        await queryRunner.query(`DROP TYPE "public"."stock_items_kind_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_292611e2a9c08cdbbad527d0a8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fefb537fce8ad87a6651e875e2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_59d44f149095f6e875b91f0ac9"`);
        await queryRunner.query(`DROP TABLE "import_receipts"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_73b60b22f5ec246f8416c9b721"`);
        await queryRunner.query(`DROP TABLE "suppliers"`);
    }

}
