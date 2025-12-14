-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'TELEGRAM', 'BOTH');

-- CreateEnum
CREATE TYPE "MetricStatus" AS ENUM ('PENDING', 'SENT', 'ACKED', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "ExperimentScenario" AS ENUM ('LATENCY', 'THROUGHPUT', 'ERROR_INJECTION');

-- CreateEnum
CREATE TYPE "ExperimentStatus" AS ENUM ('CREATED', 'RUNNING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "experiment_runs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scenario" "ExperimentScenario" NOT NULL,
    "channelTarget" "NotificationChannel" NOT NULL,
    "totalMessages" INTEGER NOT NULL,
    "concurrency" INTEGER NOT NULL,
    "ratePerSec" INTEGER,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "status" "ExperimentStatus" NOT NULL DEFAULT 'CREATED',
    "summaryJson" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "experiment_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_metric_events" (
    "id" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "template" TEXT,
    "recipientHash" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "status" "MetricStatus" NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "providerAckAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "latencyMs" INTEGER,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "experimentRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_metric_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experiment_series_points" (
    "id" TEXT NOT NULL,
    "experimentRunId" TEXT NOT NULL,
    "tOffsetSec" INTEGER NOT NULL,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "p95LatencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "experiment_series_points_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "experiment_runs_status_createdAt_idx" ON "experiment_runs"("status", "createdAt");

-- CreateIndex
CREATE INDEX "experiment_runs_scenario_idx" ON "experiment_runs"("scenario");

-- CreateIndex
CREATE INDEX "notification_metric_events_channel_createdAt_idx" ON "notification_metric_events"("channel", "createdAt");

-- CreateIndex
CREATE INDEX "notification_metric_events_experimentRunId_idx" ON "notification_metric_events"("experimentRunId");

-- CreateIndex
CREATE INDEX "notification_metric_events_status_createdAt_idx" ON "notification_metric_events"("status", "createdAt");

-- CreateIndex
CREATE INDEX "notification_metric_events_correlationId_idx" ON "notification_metric_events"("correlationId");

-- CreateIndex
CREATE INDEX "experiment_series_points_experimentRunId_tOffsetSec_idx" ON "experiment_series_points"("experimentRunId", "tOffsetSec");

-- AddForeignKey
ALTER TABLE "notification_metric_events" ADD CONSTRAINT "notification_metric_events_experimentRunId_fkey" FOREIGN KEY ("experimentRunId") REFERENCES "experiment_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiment_series_points" ADD CONSTRAINT "experiment_series_points_experimentRunId_fkey" FOREIGN KEY ("experimentRunId") REFERENCES "experiment_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

