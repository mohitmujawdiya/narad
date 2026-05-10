-- CreateTable
CREATE TABLE "Pursuit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "pastedUrl" TEXT,
    "companyName" TEXT NOT NULL,
    "companyDomain" TEXT,
    "companyResearch" TEXT,
    "fitScore" INTEGER,
    "fitReason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Saved',
    "notes" TEXT,
    "jdUrl" TEXT,
    "jdTitle" TEXT,
    "jdMarkdown" TEXT,
    "jdEvaluation" TEXT,
    "cvVariant" TEXT,
    "coverLetter" TEXT,
    "appliedAt" DATETIME,
    "contactName" TEXT,
    "contactRole" TEXT,
    "contactEmail" TEXT,
    "contactLinkedinUrl" TEXT,
    "contactTwitterUrl" TEXT,
    "outreachSubject" TEXT,
    "outreachBody" TEXT,
    "outreachConfidence" INTEGER,
    "outreachReasoning" TEXT,
    "outreachHookUsed" TEXT,
    "outreachChannel" TEXT,
    "outreachSentAt" DATETIME,
    "outreachRepliedAt" DATETIME,
    "followUps" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pursuitId" TEXT,
    "type" TEXT NOT NULL,
    "payload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityLog_pursuitId_fkey" FOREIGN KEY ("pursuitId") REFERENCES "Pursuit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "cvMarkdown" TEXT,
    "archetypes" TEXT,
    "narrative" TEXT,
    "visaDisclosurePolicy" TEXT NOT NULL DEFAULT 'never-proactive',
    "signature" TEXT,
    "sendDefaults" TEXT,
    "careerOpsPath" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ResearchCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "queryHash" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "citations" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Pursuit_status_idx" ON "Pursuit"("status");

-- CreateIndex
CREATE INDEX "Pursuit_type_idx" ON "Pursuit"("type");

-- CreateIndex
CREATE INDEX "ActivityLog_pursuitId_idx" ON "ActivityLog"("pursuitId");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchCache_queryHash_key" ON "ResearchCache"("queryHash");
