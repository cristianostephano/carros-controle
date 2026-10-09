-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Period" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "responseDeadline" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,

    CONSTRAINT "Period_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Import" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedBy" TEXT,
    "rowCount" INTEGER NOT NULL,
    "dataRangeStart" TIMESTAMP(3),
    "dataRangeEnd" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING_PREVIEW',
    "warningsJson" TEXT,

    CONSTRAINT "Import_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawTripRow" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "rawRowJson" TEXT NOT NULL,
    "veiculoRaw" TEXT NOT NULL,
    "apelidoRaw" TEXT NOT NULL,
    "motoristasRaw" TEXT,
    "dataInicioRaw" TEXT NOT NULL,
    "horaInicioRaw" TEXT NOT NULL,
    "odometroInicioRaw" TEXT,
    "dataFimRaw" TEXT NOT NULL,
    "horaFimRaw" TEXT NOT NULL,
    "odometroFimRaw" TEXT,
    "enderecoInicioRaw" TEXT,
    "latInicioRaw" TEXT,
    "lonInicioRaw" TEXT,
    "enderecoFimRaw" TEXT,
    "latFimRaw" TEXT,
    "lonFimRaw" TEXT,
    "kmRaw" TEXT,
    "tempoRaw" TEXT,
    "litrosRaw" TEXT,
    "custoRaw" TEXT,
    "velocidadeMaxRaw" TEXT,

    CONSTRAINT "RawTripRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleModel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "VehicleModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rate" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "ratePerKmCentavos" INTEGER NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "Rate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "modelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Salesperson" (
    "id" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "displayName" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Salesperson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "rawTripRowId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "salespersonId" TEXT NOT NULL,
    "startDateTime" TIMESTAMP(3) NOT NULL,
    "endDateTime" TIMESTAMP(3) NOT NULL,
    "originAddress" TEXT,
    "originLat" DOUBLE PRECISION,
    "originLon" DOUBLE PRECISION,
    "destAddress" TEXT,
    "destLat" DOUBLE PRECISION,
    "destLon" DOUBLE PRECISION,
    "km" DOUBLE PRECISION,
    "durationSeconds" INTEGER,
    "autoClassification" TEXT NOT NULL,
    "autoClassificationReason" TEXT NOT NULL,
    "salespersonDeclaration" TEXT,
    "salespersonJustification" TEXT,
    "salespersonRespondedAt" TIMESTAMP(3),
    "adminDecision" TEXT,
    "adminDecisionNote" TEXT,
    "adminDecidedAt" TIMESTAMP(3),
    "adminDecidedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AGUARDANDO_DEVOLUTIVA',
    "reimbursableKm" DOUBLE PRECISION,
    "rateAppliedCentavos" INTEGER,
    "tripValueCentavos" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripAuditLog" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorLabel" TEXT,
    "previousValueJson" TEXT,
    "newValueJson" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalespersonAccessLink" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "salespersonId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "lastAccessedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),

    CONSTRAINT "SalespersonAccessLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "customWindowStart" TEXT,
    "customWindowEnd" TEXT,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VehicleModel_name_key" ON "VehicleModel"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_plate_key" ON "Vehicle"("plate");

-- CreateIndex
CREATE UNIQUE INDEX "Salesperson_nickname_key" ON "Salesperson"("nickname");

-- CreateIndex
CREATE UNIQUE INDEX "Trip_rawTripRowId_key" ON "Trip"("rawTripRowId");

-- CreateIndex
CREATE UNIQUE INDEX "SalespersonAccessLink_token_key" ON "SalespersonAccessLink"("token");

-- CreateIndex
CREATE UNIQUE INDEX "SalespersonAccessLink_periodId_salespersonId_key" ON "SalespersonAccessLink"("periodId", "salespersonId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_name_key" ON "AdminUser"("name");

-- AddForeignKey
ALTER TABLE "Import" ADD CONSTRAINT "Import_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawTripRow" ADD CONSTRAINT "RawTripRow_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rate" ADD CONSTRAINT "Rate_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "VehicleModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "VehicleModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_rawTripRowId_fkey" FOREIGN KEY ("rawTripRowId") REFERENCES "RawTripRow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "Salesperson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripAuditLog" ADD CONSTRAINT "TripAuditLog_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalespersonAccessLink" ADD CONSTRAINT "SalespersonAccessLink_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalespersonAccessLink" ADD CONSTRAINT "SalespersonAccessLink_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "Salesperson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

