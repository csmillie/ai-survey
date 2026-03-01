-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER',
    `disabledAt` DATETIME(3) NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_role_idx`(`role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Survey` (
    `id` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `Survey_ownerId_idx`(`ownerId`),
    INDEX `Survey_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SurveyShare` (
    `id` VARCHAR(191) NOT NULL,
    `surveyId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `role` ENUM('VIEW', 'EDIT') NOT NULL DEFAULT 'EDIT',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SurveyShare_userId_idx`(`userId`),
    INDEX `SurveyShare_surveyId_idx`(`surveyId`),
    UNIQUE INDEX `SurveyShare_surveyId_userId_key`(`surveyId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Variable` (
    `id` VARCHAR(191) NOT NULL,
    `surveyId` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NULL,
    `defaultValue` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Variable_surveyId_idx`(`surveyId`),
    UNIQUE INDEX `Variable_surveyId_key_key`(`surveyId`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Question` (
    `id` VARCHAR(191) NOT NULL,
    `surveyId` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `promptTemplate` TEXT NOT NULL,
    `type` ENUM('OPEN_ENDED', 'RANKED') NOT NULL DEFAULT 'OPEN_ENDED',
    `configJson` JSON NULL,
    `mode` ENUM('STATELESS', 'THREADED') NOT NULL DEFAULT 'STATELESS',
    `threadKey` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Question_surveyId_order_idx`(`surveyId`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ModelTarget` (
    `id` VARCHAR(191) NOT NULL,
    `provider` ENUM('OPENAI', 'ANTHROPIC', 'GEMINI', 'XAI', 'PERPLEXITY', 'COPILOT') NOT NULL,
    `modelName` VARCHAR(191) NOT NULL,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `isDefaultCostEffective` BOOLEAN NOT NULL DEFAULT false,
    `inputTokenCostUsd` DECIMAL(12, 6) NOT NULL,
    `outputTokenCostUsd` DECIMAL(12, 6) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ModelTarget_isEnabled_idx`(`isEnabled`),
    INDEX `ModelTarget_isDefaultCostEffective_idx`(`isDefaultCostEffective`),
    UNIQUE INDEX `ModelTarget_provider_modelName_key`(`provider`, `modelName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SurveyRun` (
    `id` VARCHAR(191) NOT NULL,
    `surveyId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `settingsJson` JSON NOT NULL,
    `limitsJson` JSON NOT NULL,
    `estimatedJson` JSON NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `recommendationJson` JSON NULL,

    INDEX `SurveyRun_surveyId_createdAt_idx`(`surveyId`, `createdAt`),
    INDEX `SurveyRun_surveyId_status_completedAt_idx`(`surveyId`, `status`, `completedAt`),
    INDEX `SurveyRun_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RunModel` (
    `id` VARCHAR(191) NOT NULL,
    `runId` VARCHAR(191) NOT NULL,
    `modelTargetId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RunModel_runId_idx`(`runId`),
    UNIQUE INDEX `RunModel_runId_modelTargetId_key`(`runId`, `modelTargetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ConversationThread` (
    `id` VARCHAR(191) NOT NULL,
    `runId` VARCHAR(191) NOT NULL,
    `modelTargetId` VARCHAR(191) NOT NULL,
    `threadKey` VARCHAR(191) NOT NULL,
    `messagesJson` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ConversationThread_runId_idx`(`runId`),
    UNIQUE INDEX `ConversationThread_runId_modelTargetId_threadKey_key`(`runId`, `modelTargetId`, `threadKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Job` (
    `id` VARCHAR(191) NOT NULL,
    `runId` VARCHAR(191) NOT NULL,
    `modelTargetId` VARCHAR(191) NOT NULL,
    `questionId` VARCHAR(191) NULL,
    `threadKey` VARCHAR(191) NOT NULL,
    `type` ENUM('EXECUTE_QUESTION', 'ANALYZE_RESPONSE', 'EXPORT_RUN', 'COMPUTE_METRICS') NOT NULL,
    `status` ENUM('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'RETRYING', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `attempt` INTEGER NOT NULL DEFAULT 0,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `payloadJson` JSON NOT NULL,
    `startedAt` DATETIME(3) NULL,
    `finishedAt` DATETIME(3) NULL,
    `lastError` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Job_idempotencyKey_key`(`idempotencyKey`),
    INDEX `Job_runId_status_idx`(`runId`, `status`),
    INDEX `Job_type_status_idx`(`type`, `status`),
    INDEX `Job_runId_type_status_idx`(`runId`, `type`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LlmResponse` (
    `id` VARCHAR(191) NOT NULL,
    `runId` VARCHAR(191) NOT NULL,
    `modelTargetId` VARCHAR(191) NOT NULL,
    `questionId` VARCHAR(191) NOT NULL,
    `threadKey` VARCHAR(191) NOT NULL,
    `rawText` LONGTEXT NOT NULL,
    `parsedJson` JSON NULL,
    `reasoningText` TEXT NULL,
    `citationsJson` JSON NULL,
    `usageJson` JSON NULL,
    `requestMessagesJson` JSON NULL,
    `confidence` DOUBLE NULL,
    `costUsd` DECIMAL(12, 6) NULL,
    `latencyMs` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LlmResponse_runId_modelTargetId_idx`(`runId`, `modelTargetId`),
    UNIQUE INDEX `LlmResponse_runId_modelTargetId_questionId_threadKey_key`(`runId`, `modelTargetId`, `questionId`, `threadKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AnalysisResult` (
    `id` VARCHAR(191) NOT NULL,
    `responseId` VARCHAR(191) NOT NULL,
    `sentimentScore` DOUBLE NULL,
    `entitiesJson` JSON NULL,
    `brandMentionsJson` JSON NULL,
    `institutionMentionsJson` JSON NULL,
    `flagsJson` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AnalysisResult_responseId_key`(`responseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditEvent` (
    `id` VARCHAR(191) NOT NULL,
    `actorUserId` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `targetType` VARCHAR(191) NOT NULL,
    `targetId` VARCHAR(191) NOT NULL,
    `metaJson` JSON NULL,
    `ip` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `runTargetId` VARCHAR(191) NULL,

    INDEX `AuditEvent_actorUserId_createdAt_idx`(`actorUserId`, `createdAt`),
    INDEX `AuditEvent_targetType_targetId_idx`(`targetType`, `targetId`),
    INDEX `AuditEvent_action_idx`(`action`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RunModelMetric` (
    `id` VARCHAR(191) NOT NULL,
    `runId` VARCHAR(191) NOT NULL,
    `modelTargetId` VARCHAR(191) NOT NULL,
    `reliabilityScore` DOUBLE NOT NULL,
    `jsonValidRate` DOUBLE NOT NULL,
    `emptyAnswerRate` DOUBLE NOT NULL,
    `shortAnswerRate` DOUBLE NOT NULL,
    `citationRate` DOUBLE NOT NULL,
    `latencyCv` DOUBLE NOT NULL,
    `costCv` DOUBLE NOT NULL,
    `calibrationScore` DOUBLE NULL,
    `penaltyBreakdownJson` JSON NOT NULL,
    `totalResponses` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RunModelMetric_runId_idx`(`runId`),
    INDEX `RunModelMetric_modelTargetId_idx`(`modelTargetId`),
    UNIQUE INDEX `RunModelMetric_runId_modelTargetId_key`(`runId`, `modelTargetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RunQuestionAgreement` (
    `id` VARCHAR(191) NOT NULL,
    `runId` VARCHAR(191) NOT NULL,
    `questionId` VARCHAR(191) NOT NULL,
    `agreementPercent` DOUBLE NOT NULL,
    `outlierModelsJson` JSON NOT NULL,
    `humanReviewFlag` BOOLEAN NOT NULL,
    `overconfidentModelsJson` JSON NULL,
    `clusterDetailsJson` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RunQuestionAgreement_runId_idx`(`runId`),
    INDEX `RunQuestionAgreement_questionId_idx`(`questionId`),
    UNIQUE INDEX `RunQuestionAgreement_runId_questionId_key`(`runId`, `questionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Survey` ADD CONSTRAINT `Survey_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SurveyShare` ADD CONSTRAINT `SurveyShare_surveyId_fkey` FOREIGN KEY (`surveyId`) REFERENCES `Survey`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SurveyShare` ADD CONSTRAINT `SurveyShare_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Variable` ADD CONSTRAINT `Variable_surveyId_fkey` FOREIGN KEY (`surveyId`) REFERENCES `Survey`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Question` ADD CONSTRAINT `Question_surveyId_fkey` FOREIGN KEY (`surveyId`) REFERENCES `Survey`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SurveyRun` ADD CONSTRAINT `SurveyRun_surveyId_fkey` FOREIGN KEY (`surveyId`) REFERENCES `Survey`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SurveyRun` ADD CONSTRAINT `SurveyRun_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RunModel` ADD CONSTRAINT `RunModel_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `SurveyRun`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RunModel` ADD CONSTRAINT `RunModel_modelTargetId_fkey` FOREIGN KEY (`modelTargetId`) REFERENCES `ModelTarget`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConversationThread` ADD CONSTRAINT `ConversationThread_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `SurveyRun`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ConversationThread` ADD CONSTRAINT `ConversationThread_modelTargetId_fkey` FOREIGN KEY (`modelTargetId`) REFERENCES `ModelTarget`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Job` ADD CONSTRAINT `Job_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `SurveyRun`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Job` ADD CONSTRAINT `Job_modelTargetId_fkey` FOREIGN KEY (`modelTargetId`) REFERENCES `ModelTarget`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Job` ADD CONSTRAINT `Job_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LlmResponse` ADD CONSTRAINT `LlmResponse_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `SurveyRun`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LlmResponse` ADD CONSTRAINT `LlmResponse_modelTargetId_fkey` FOREIGN KEY (`modelTargetId`) REFERENCES `ModelTarget`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LlmResponse` ADD CONSTRAINT `LlmResponse_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AnalysisResult` ADD CONSTRAINT `AnalysisResult_responseId_fkey` FOREIGN KEY (`responseId`) REFERENCES `LlmResponse`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditEvent` ADD CONSTRAINT `AuditEvent_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditEvent` ADD CONSTRAINT `AuditEvent_runTargetId_fkey` FOREIGN KEY (`runTargetId`) REFERENCES `SurveyRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RunModelMetric` ADD CONSTRAINT `RunModelMetric_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `SurveyRun`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RunModelMetric` ADD CONSTRAINT `RunModelMetric_modelTargetId_fkey` FOREIGN KEY (`modelTargetId`) REFERENCES `ModelTarget`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RunQuestionAgreement` ADD CONSTRAINT `RunQuestionAgreement_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `SurveyRun`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RunQuestionAgreement` ADD CONSTRAINT `RunQuestionAgreement_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

