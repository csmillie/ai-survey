-- CreateTable
CREATE TABLE `RunQuestionTruth` (
    `id` VARCHAR(191) NOT NULL,
    `runId` VARCHAR(191) NOT NULL,
    `questionId` VARCHAR(191) NOT NULL,
    `truthScore` DOUBLE NOT NULL,
    `truthLabel` VARCHAR(191) NOT NULL,
    `consensusPercent` DOUBLE NOT NULL,
    `citationRate` DOUBLE NOT NULL,
    `numericDisagreementsJson` JSON NOT NULL,
    `claimClustersJson` JSON NOT NULL,
    `breakdownJson` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RunQuestionTruth_runId_idx`(`runId`),
    INDEX `RunQuestionTruth_questionId_idx`(`questionId`),
    UNIQUE INDEX `RunQuestionTruth_runId_questionId_key`(`runId`, `questionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RunQuestionReferee` (
    `id` VARCHAR(191) NOT NULL,
    `runId` VARCHAR(191) NOT NULL,
    `questionId` VARCHAR(191) NOT NULL,
    `refereeModelKey` VARCHAR(191) NOT NULL,
    `summary` TEXT NOT NULL,
    `disagreementsJson` JSON NOT NULL,
    `verifyChecklistJson` JSON NOT NULL,
    `recommendedAnswerModelKey` VARCHAR(191) NULL,
    `confidence` DOUBLE NOT NULL,
    `rawJson` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RunQuestionReferee_runId_idx`(`runId`),
    INDEX `RunQuestionReferee_questionId_idx`(`questionId`),
    UNIQUE INDEX `RunQuestionReferee_runId_questionId_key`(`runId`, `questionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RunQuestionTruth` ADD CONSTRAINT `RunQuestionTruth_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `SurveyRun`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RunQuestionTruth` ADD CONSTRAINT `RunQuestionTruth_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RunQuestionReferee` ADD CONSTRAINT `RunQuestionReferee_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `SurveyRun`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RunQuestionReferee` ADD CONSTRAINT `RunQuestionReferee_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

