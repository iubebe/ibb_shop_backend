import { MigrationInterface, QueryRunner } from "typeorm";

export class InitSchema1791134575437 implements MigrationInterface {
    name = 'InitSchema1791134575437'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "branches" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying NOT NULL, "address" character varying, CONSTRAINT "PK_7f37d3b42defea97f1df0d19535" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "branchId" uuid NOT NULL, "name" character varying NOT NULL, CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_bc8b8168e0a55ed946a5b9f294" ON "categories"  ("branchId") `);
        await queryRunner.query(`CREATE TABLE "tables" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "branchId" uuid NOT NULL, "name" character varying NOT NULL, "qrToken" character varying NOT NULL, CONSTRAINT "PK_7cf2aca7af9550742f855d4eb69" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_9b08619b41dc6f882cf492be81" ON "tables"  ("branchId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_0fc85221960b588e27d825c4ab" ON "tables"  ("qrToken") `);
        await queryRunner.query(`CREATE TABLE "products" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "branchId" uuid NOT NULL, "categoryId" uuid, "name" character varying NOT NULL, "price" numeric(12,2) NOT NULL, "imageUrl" character varying, "isActive" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_0806c755e0aca124e67c0cf6d7d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_dd1b22e313f7e7d28805557261" ON "products"  ("branchId") `);
        await queryRunner.query(`CREATE INDEX "IDX_ff56834e735fa78a15d0cf2192" ON "products"  ("categoryId") `);
        await queryRunner.query(`CREATE TABLE "inventory_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "branchId" uuid NOT NULL, "productId" uuid NOT NULL, "quantity" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_cf2f451407242e132547ac19169" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_18e7b7cb1585b1785ba30c84fc" ON "inventory_items"  ("branchId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_4a1e232a660d7d51a13f20099b" ON "inventory_items"  ("productId") `);
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('admin', 'staff', 'cashier')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "branchId" uuid NOT NULL, "name" character varying NOT NULL, "email" character varying NOT NULL, "passwordHash" character varying NOT NULL, "role" "public"."users_role_enum" NOT NULL DEFAULT 'staff', CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_246426dfd001466a1d5e47322f" ON "users"  ("branchId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users"  ("email") `);
        await queryRunner.query(`CREATE TYPE "public"."orders_status_enum" AS ENUM('pending_confirmation', 'confirmed', 'paid', 'cancelled')`);
        await queryRunner.query(`CREATE TYPE "public"."orders_paymentmethod_enum" AS ENUM('cash', 'qr_manual')`);
        await queryRunner.query(`CREATE TYPE "public"."orders_paymentstatus_enum" AS ENUM('pending', 'paid')`);
        await queryRunner.query(`CREATE TABLE "orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "branchId" uuid NOT NULL, "tableId" uuid, "createdByUserId" uuid, "status" "public"."orders_status_enum" NOT NULL DEFAULT 'pending_confirmation', "paymentMethod" "public"."orders_paymentmethod_enum", "paymentStatus" "public"."orders_paymentstatus_enum" NOT NULL DEFAULT 'pending', "total" numeric(12,2) NOT NULL DEFAULT '0', "confirmedAt" TIMESTAMP WITH TIME ZONE, "paidAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_2a7fdd7af437285a3ef0fc8b64" ON "orders"  ("tableId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8736d7c044929b8c3d4d63a763" ON "orders"  ("branchId", "status") `);
        await queryRunner.query(`CREATE TABLE "order_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "orderId" uuid NOT NULL, "productId" uuid NOT NULL, "quantity" integer NOT NULL, "unitPrice" numeric(12,2) NOT NULL, "notes" character varying, CONSTRAINT "PK_005269d8574e6fac0493715c308" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_f1d359a55923bb45b057fbdab0" ON "order_items"  ("orderId") `);
        await queryRunner.query(`CREATE INDEX "IDX_cdb99c05982d5191ac8465ac01" ON "order_items"  ("productId") `);
        await queryRunner.query(`CREATE TABLE "payment_qr_codes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "branchId" uuid NOT NULL, "label" character varying NOT NULL, "imagePath" character varying NOT NULL, "isActive" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_f8671dc5034b5a4ad915f133407" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a7f1fd941e659f2607893cb122" ON "payment_qr_codes"  ("branchId") `);
        await queryRunner.query(`CREATE TYPE "public"."stock_movements_reason_enum" AS ENUM('sale', 'manual_adjustment', 'restock')`);
        await queryRunner.query(`CREATE TABLE "stock_movements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "inventoryItemId" uuid NOT NULL, "change" integer NOT NULL, "reason" "public"."stock_movements_reason_enum" NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "createdByUserId" uuid, CONSTRAINT "PK_57a26b190618550d8e65fb860e7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_769feb209282a3f34e42d89f1d" ON "stock_movements"  ("inventoryItemId") `);
        await queryRunner.query(`ALTER TABLE "categories" ADD CONSTRAINT "FK_bc8b8168e0a55ed946a5b9f2947" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tables" ADD CONSTRAINT "FK_9b08619b41dc6f882cf492be815" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "products" ADD CONSTRAINT "FK_dd1b22e313f7e7d28805557261f" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "products" ADD CONSTRAINT "FK_ff56834e735fa78a15d0cf21926" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "inventory_items" ADD CONSTRAINT "FK_18e7b7cb1585b1785ba30c84fc9" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "inventory_items" ADD CONSTRAINT "FK_4a1e232a660d7d51a13f20099b2" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "FK_246426dfd001466a1d5e47322f4" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "FK_873d9661d948ee484150cf4c73d" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "FK_2a7fdd7af437285a3ef0fc8b64f" FOREIGN KEY ("tableId") REFERENCES "tables"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "FK_1966cb7dd250abd223a27b62030" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "order_items" ADD CONSTRAINT "FK_f1d359a55923bb45b057fbdab0d" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "order_items" ADD CONSTRAINT "FK_cdb99c05982d5191ac8465ac010" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payment_qr_codes" ADD CONSTRAINT "FK_a7f1fd941e659f2607893cb122b" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "stock_movements" ADD CONSTRAINT "FK_769feb209282a3f34e42d89f1dd" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "stock_movements" ADD CONSTRAINT "FK_1b050a639e023e0d806be50395f" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "stock_movements" DROP CONSTRAINT "FK_1b050a639e023e0d806be50395f"`);
        await queryRunner.query(`ALTER TABLE "stock_movements" DROP CONSTRAINT "FK_769feb209282a3f34e42d89f1dd"`);
        await queryRunner.query(`ALTER TABLE "payment_qr_codes" DROP CONSTRAINT "FK_a7f1fd941e659f2607893cb122b"`);
        await queryRunner.query(`ALTER TABLE "order_items" DROP CONSTRAINT "FK_cdb99c05982d5191ac8465ac010"`);
        await queryRunner.query(`ALTER TABLE "order_items" DROP CONSTRAINT "FK_f1d359a55923bb45b057fbdab0d"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_1966cb7dd250abd223a27b62030"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_2a7fdd7af437285a3ef0fc8b64f"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_873d9661d948ee484150cf4c73d"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_246426dfd001466a1d5e47322f4"`);
        await queryRunner.query(`ALTER TABLE "inventory_items" DROP CONSTRAINT "FK_4a1e232a660d7d51a13f20099b2"`);
        await queryRunner.query(`ALTER TABLE "inventory_items" DROP CONSTRAINT "FK_18e7b7cb1585b1785ba30c84fc9"`);
        await queryRunner.query(`ALTER TABLE "products" DROP CONSTRAINT "FK_ff56834e735fa78a15d0cf21926"`);
        await queryRunner.query(`ALTER TABLE "products" DROP CONSTRAINT "FK_dd1b22e313f7e7d28805557261f"`);
        await queryRunner.query(`ALTER TABLE "tables" DROP CONSTRAINT "FK_9b08619b41dc6f882cf492be815"`);
        await queryRunner.query(`ALTER TABLE "categories" DROP CONSTRAINT "FK_bc8b8168e0a55ed946a5b9f2947"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_769feb209282a3f34e42d89f1d"`);
        await queryRunner.query(`DROP TABLE "stock_movements"`);
        await queryRunner.query(`DROP TYPE "public"."stock_movements_reason_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a7f1fd941e659f2607893cb122"`);
        await queryRunner.query(`DROP TABLE "payment_qr_codes"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cdb99c05982d5191ac8465ac01"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f1d359a55923bb45b057fbdab0"`);
        await queryRunner.query(`DROP TABLE "order_items"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8736d7c044929b8c3d4d63a763"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2a7fdd7af437285a3ef0fc8b64"`);
        await queryRunner.query(`DROP TABLE "orders"`);
        await queryRunner.query(`DROP TYPE "public"."orders_paymentstatus_enum"`);
        await queryRunner.query(`DROP TYPE "public"."orders_paymentmethod_enum"`);
        await queryRunner.query(`DROP TYPE "public"."orders_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_246426dfd001466a1d5e47322f"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4a1e232a660d7d51a13f20099b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_18e7b7cb1585b1785ba30c84fc"`);
        await queryRunner.query(`DROP TABLE "inventory_items"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ff56834e735fa78a15d0cf2192"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dd1b22e313f7e7d28805557261"`);
        await queryRunner.query(`DROP TABLE "products"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0fc85221960b588e27d825c4ab"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9b08619b41dc6f882cf492be81"`);
        await queryRunner.query(`DROP TABLE "tables"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bc8b8168e0a55ed946a5b9f294"`);
        await queryRunner.query(`DROP TABLE "categories"`);
        await queryRunner.query(`DROP TABLE "branches"`);
    }

}
