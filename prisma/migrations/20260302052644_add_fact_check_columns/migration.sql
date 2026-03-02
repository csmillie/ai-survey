-- AlterTable
ALTER TABLE `AnalysisResult` ADD COLUMN `citationAnalysisJson` JSON NULL,
    ADD COLUMN `claimsJson` JSON NULL,
    ADD COLUMN `keySentencesJson` JSON NULL;

-- AlterTable
ALTER TABLE `RunQuestionAgreement` ADD COLUMN `factComparisonJson` JSON NULL,
    ADD COLUMN `factConfidenceLevel` VARCHAR(191) NULL,
    ADD COLUMN `factConfidenceScore` DOUBLE NULL,
    ADD COLUMN `factConfidenceSignals` JSON NULL;
