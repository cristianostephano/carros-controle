-- CreateTable
CREATE TABLE "Period" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "responseDeadline" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "closedAt" DATETIME,
    "closedBy" TEXT
);

-- CreateTable
CREATE TABLE "Import" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "periodId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedBy" TEXT,
    "rowCount" INTEGER NOT NULL,
    "dataRangeStart" DATETIME,
    "dataRangeEnd" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING_PREVIEW',
    "warningsJson" TEXT,
    CONSTRAINT "Import_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RawTripRow" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    CONSTRAINT "RawTripRow_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VehicleModel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Rate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "modelId" TEXT NOT NULL,
    "ratePerKmCentavos" INTEGER NOT NULL,
    "effectiveDate" DATETIME NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    CONSTRAINT "Rate_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "VehicleModel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plate" TEXT NOT NULL,
    "modelId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Vehicle_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "VehicleModel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Salesperson" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nickname" TEXT NOT NULL,
    "displayName" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rawTripRowId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "salespersonId" TEXT NOT NULL,
    "startDateTime" DATETIME NOT NULL,
    "endDateTime" DATETIME NOT NULL,
    "originAddress" TEXT,
    "originLat" REAL,
    "originLon" REAL,
    "destAddress" TEXT,
    "destLat" REAL,
    "destLon" REAL,
    "km" REAL,
    "durationSeconds" INTEGER,
    "autoClassification" TEXT NOT NULL,
    "autoClassificationReason" TEXT NOT NULL,
    "salespersonDeclaration" TEXT,
    "salespersonJustification" TEXT,
    "salespersonRespondedAt" DATETIME,
    "adminDecision" TEXT,
    "adminDecisionNote" TEXT,
    "adminDecidedAt" DATETIME,
    "adminDecidedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AGUARDANDO_DEVOLUTIVA',
    "reimbursableKm" REAL,
    "rateAppliedCentavos" INTEGER,
    "tripValueCentavos" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Trip_rawTripRowId_fkey" FOREIGN KEY ("rawTripRowId") REFERENCES "RawTripRow" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Trip_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Trip_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Trip_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "Salesperson" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TripAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tripId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorLabel" TEXT,
    "previousValueJson" TEXT,
    "newValueJson" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TripAuditLog_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SalespersonAccessLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "salespersonId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "lastAccessedAt" DATETIME,
    "submittedAt" DATETIME,
    CONSTRAINT "SalespersonAccessLink_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SalespersonAccessLink_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "Salesperson" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "customWindowStart" TEXT,
    "customWindowEnd" TEXT,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Import_fileHash_key" ON "Import"("fileHash");

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
