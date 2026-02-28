-- CreateTable
CREATE TABLE "Bundle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "discountType" TEXT NOT NULL,
    "discountValue" DECIMAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BundleItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bundleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "requiredQuantity" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "BundleItem_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
