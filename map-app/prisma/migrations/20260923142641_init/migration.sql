-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "shopifyDomain" TEXT NOT NULL,
    "shopifyShopId" TEXT NOT NULL,
    "accessTokenEncrypted" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocationType" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LocationType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpeningHour" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "openTime" TEXT,
    "closeTime" TEXT,
    "closed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OpeningHour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocationTag" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "LocationTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocationTagRelation" (
    "locationId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "LocationTagRelation_pkey" PRIMARY KEY ("locationId","tagId")
);

-- CreateTable
CREATE TABLE "LocationProduct" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "shopifyVariantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocationProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "mapProvider" TEXT NOT NULL DEFAULT 'openfreemap',
    "defaultLatitude" DECIMAL(10,7),
    "defaultLongitude" DECIMAL(10,7),
    "defaultZoom" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "searchRadius" INTEGER NOT NULL DEFAULT 50,
    "enableGeolocation" BOOLEAN NOT NULL DEFAULT true,
    "showDirections" BOOLEAN NOT NULL DEFAULT true,
    "showPhone" BOOLEAN NOT NULL DEFAULT true,
    "showWebsite" BOOLEAN NOT NULL DEFAULT true,
    "showOpeningHours" BOOLEAN NOT NULL DEFAULT true,
    "mapStyle" TEXT NOT NULL DEFAULT 'liberty',
    "markerStyle" TEXT NOT NULL DEFAULT 'pin',
    "primaryColor" TEXT NOT NULL DEFAULT '#176274',
    "accentColor" TEXT NOT NULL DEFAULT '#4ca9ba',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeocodingCache" (
    "id" TEXT NOT NULL,
    "addressHash" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "formattedAddress" TEXT NOT NULL,
    "rawResponse" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeocodingCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Shop_shopifyDomain_key" ON "Shop"("shopifyDomain");

-- CreateIndex
CREATE UNIQUE INDEX "Shop_shopifyShopId_key" ON "Shop"("shopifyShopId");

-- CreateIndex
CREATE INDEX "Shop_shopifyShopId_idx" ON "Shop"("shopifyShopId");

-- CreateIndex
CREATE INDEX "Location_shopId_published_idx" ON "Location"("shopId", "published");

-- CreateIndex
CREATE INDEX "Location_shopId_city_idx" ON "Location"("shopId", "city");

-- CreateIndex
CREATE INDEX "Location_shopId_countryCode_idx" ON "Location"("shopId", "countryCode");

-- CreateIndex
CREATE INDEX "Location_shopId_type_idx" ON "Location"("shopId", "type");

-- CreateIndex
CREATE INDEX "Location_latitude_longitude_idx" ON "Location"("latitude", "longitude");

-- CreateIndex
CREATE UNIQUE INDEX "Location_shopId_slug_key" ON "Location"("shopId", "slug");

-- CreateIndex
CREATE INDEX "LocationType_shopId_active_idx" ON "LocationType"("shopId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "LocationType_shopId_slug_key" ON "LocationType"("shopId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "OpeningHour_locationId_dayOfWeek_key" ON "OpeningHour"("locationId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "LocationTag_shopId_idx" ON "LocationTag"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "LocationTag_shopId_slug_key" ON "LocationTag"("shopId", "slug");

-- CreateIndex
CREATE INDEX "LocationTagRelation_tagId_idx" ON "LocationTagRelation"("tagId");

-- CreateIndex
CREATE INDEX "LocationProduct_shopifyProductId_idx" ON "LocationProduct"("shopifyProductId");

-- CreateIndex
CREATE UNIQUE INDEX "LocationProduct_locationId_shopifyProductId_shopifyVariantI_key" ON "LocationProduct"("locationId", "shopifyProductId", "shopifyVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "Settings_shopId_key" ON "Settings"("shopId");

-- CreateIndex
CREATE INDEX "GeocodingCache_addressHash_idx" ON "GeocodingCache"("addressHash");

-- CreateIndex
CREATE UNIQUE INDEX "GeocodingCache_addressHash_provider_key" ON "GeocodingCache"("addressHash", "provider");

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationType" ADD CONSTRAINT "LocationType_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpeningHour" ADD CONSTRAINT "OpeningHour_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationTag" ADD CONSTRAINT "LocationTag_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationTagRelation" ADD CONSTRAINT "LocationTagRelation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationTagRelation" ADD CONSTRAINT "LocationTagRelation_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "LocationTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationProduct" ADD CONSTRAINT "LocationProduct_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settings" ADD CONSTRAINT "Settings_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
