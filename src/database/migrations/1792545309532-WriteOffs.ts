import { MigrationInterface, QueryRunner } from "typeorm";

export class WriteOffs1792545309532 implements MigrationInterface {
    name = 'WriteOffs1792545309532'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."write_offs_cause_enum" AS ENUM('expired', 'spoiled', 'damaged', 'other')`);
        await queryRunner.query(`CREATE TYPE "public"."write_offs_status_enum" AS ENUM('pending', 'confirmed', 'rejected')`);
        await queryRunner.query(`CREATE TABLE "write_offs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "branchId" uuid NOT NULL, "stockItemId" uuid NOT NULL, "quantity" numeric(14,3) NOT NULL, "cause" "public"."write_offs_cause_enum" NOT NULL, "note" character varying, "status" "public"."write_offs_status_enum" NOT NULL DEFAULT 'confirmed', "unitCost" numeric(14,2) NOT NULL DEFAULT '0', "totalCost" numeric(14,2) NOT NULL DEFAULT '0', "writtenOffAt" TIMESTAMP WITH TIME ZONE, "rejectReason" character varying, "reviewedByUserId" uuid, "reviewedAt" TIMESTAMP WITH TIME ZONE, "createdByUserId" uuid, CONSTRAINT "PK_5ea700b624a2713f69dcf5998ae" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_d52d292fe4da8ce0df9e01297b" ON "write_offs"  ("branchId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f6f715353e6c38d0b3094b25ba" ON "write_offs"  ("stockItemId") `);
        await queryRunner.query(`CREATE INDEX "IDX_817bb0e36a2f3efb864e3777b7" ON "write_offs"  ("writtenOffAt") `);
        await queryRunner.query(`ALTER TABLE "stock_items" ADD "shelfLifeDays" integer`);
        await queryRunner.query(`ALTER TYPE "public"."stock_item_movements_reason_enum" ADD VALUE 'write_off'`);
        await queryRunner.query(`ALTER TABLE "write_offs" ADD CONSTRAINT "FK_d52d292fe4da8ce0df9e01297b1" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "write_offs" ADD CONSTRAINT "FK_f6f715353e6c38d0b3094b25bac" FOREIGN KEY ("stockItemId") REFERENCES "stock_items"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "write_offs" ADD CONSTRAINT "FK_b34f1790b9a94162587152b7552" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "write_offs" DROP CONSTRAINT "FK_b34f1790b9a94162587152b7552"`);
        await queryRunner.query(`ALTER TABLE "write_offs" DROP CONSTRAINT "FK_f6f715353e6c38d0b3094b25bac"`);
        await queryRunner.query(`ALTER TABLE "write_offs" DROP CONSTRAINT "FK_d52d292fe4da8ce0df9e01297b1"`);
        await queryRunner.query(`CREATE TYPE "public"."stock_item_movements_reason_enum_old" AS ENUM('import', 'adjustment')`);
        await queryRunner.query(`ALTER TABLE "stock_item_movements" ALTER COLUMN "reason" TYPE "public"."stock_item_movements_reason_enum_old" USING "reason"::"text"::"public"."stock_item_movements_reason_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."stock_item_movements_reason_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."stock_item_movements_reason_enum_old" RENAME TO "stock_item_movements_reason_enum"`);
        await queryRunner.query(`ALTER TABLE "stock_items" DROP COLUMN "shelfLifeDays"`);
        await queryRunner.query(`DROP TABLE "write_offs"`);
        await queryRunner.query(`DROP TYPE "public"."write_offs_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."write_offs_cause_enum"`);
    }

}
