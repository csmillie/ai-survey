-- AlterTable
ALTER TABLE `LlmResponse` ADD COLUMN `verificationStatus` ENUM('UNREVIEWED', 'VERIFIED', 'INACCURATE') NOT NULL DEFAULT 'UNREVIEWED',
    ADD COLUMN `verifiedAt` DATETIME(3) NULL,
    ADD COLUMN `verifiedByUserId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `LlmResponse_runId_verificationStatus_idx` ON `LlmResponse`(`runId`, `verificationStatus`);

-- AddForeignKey
ALTER TABLE `LlmResponse` ADD CONSTRAINT `LlmResponse_verifiedByUserId_fkey` FOREIGN KEY (`verifiedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
