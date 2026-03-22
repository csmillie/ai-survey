-- AlterTable
ALTER TABLE `LlmResponse` ADD COLUMN `matrixRowKey` VARCHAR(191) NULL,
    ADD COLUMN `normalizedScore` DOUBLE NULL,
    ADD COLUMN `selectedOptionValue` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Question` ADD COLUMN `benchmarkNotes` TEXT NULL,
    ADD COLUMN `code` VARCHAR(191) NULL,
    ADD COLUMN `constructKey` VARCHAR(191) NULL,
    ADD COLUMN `helpText` TEXT NULL,
    ADD COLUMN `isBenchmarkAnchor` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `sourceSurvey` VARCHAR(191) NULL,
    ADD COLUMN `sourceVariable` VARCHAR(191) NULL,
    MODIFY `type` ENUM('OPEN_ENDED', 'RANKED', 'SINGLE_SELECT', 'BINARY', 'FORCED_CHOICE', 'LIKERT', 'NUMERIC_SCALE', 'MATRIX_LIKERT') NOT NULL DEFAULT 'OPEN_ENDED';

-- AlterTable
ALTER TABLE `Survey` ADD COLUMN `benchmarkSource` VARCHAR(191) NULL,
    ADD COLUMN `benchmarkVersion` VARCHAR(191) NULL,
    ADD COLUMN `executionMode` VARCHAR(191) NULL DEFAULT 'standard',
    ADD COLUMN `isBenchmarkInstrument` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `MatrixRow` (
    `id` VARCHAR(191) NOT NULL,
    `questionId` VARCHAR(191) NOT NULL,
    `rowKey` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL,
    `sourceVariable` VARCHAR(191) NULL,
    `constructKey` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MatrixRow_questionId_order_idx`(`questionId`, `order`),
    UNIQUE INDEX `MatrixRow_questionId_rowKey_key`(`questionId`, `rowKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MatrixRow` ADD CONSTRAINT `MatrixRow_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
