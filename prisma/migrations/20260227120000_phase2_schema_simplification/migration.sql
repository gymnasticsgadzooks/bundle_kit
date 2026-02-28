-- CreateTable
CREATE TABLE "ShopConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "consolidatedNodeId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopConfig_shop_key" ON "ShopConfig"("shop");

-- Drop legacy ShopSettings table
DROP TABLE IF EXISTS "ShopSettings";

-- Redefine Bundle table without per-bundle Shopify discount ID
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Bundle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "discountType" TEXT,
    "discountValue" DECIMAL,
    "targetQuantity" INTEGER,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "stacksWithProductDiscounts" BOOLEAN NOT NULL DEFAULT true,
    "stacksWithOrderDiscounts" BOOLEAN NOT NULL DEFAULT true,
    "stacksWithShippingDiscounts" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "new_Bundle" (
    "id",
    "shop",
    "title",
    "type",
    "status",
    "discountType",
    "discountValue",
    "targetQuantity",
    "priority",
    "stacksWithProductDiscounts",
    "stacksWithOrderDiscounts",
    "stacksWithShippingDiscounts",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "shop",
    "title",
    "type",
    "status",
    "discountType",
    "discountValue",
    "targetQuantity",
    "priority",
    "stacksWithProductDiscounts",
    "stacksWithOrderDiscounts",
    "stacksWithShippingDiscounts",
    "createdAt",
    "updatedAt"
FROM "Bundle";

DROP TABLE "Bundle";
ALTER TABLE "new_Bundle" RENAME TO "Bundle";

PRAGMA foreign_keys=ON;
