-- AlterTable: widen costUsd precision from Decimal(12,6) to Decimal(18,12)
ALTER TABLE `LlmResponse` MODIFY COLUMN `costUsd` DECIMAL(18, 12) NULL;
