-- Drop the old unique constraint on email (will use emailHash instead)
DROP INDEX `BetaSignup_email_key` ON `BetaSignup`;

-- Add emailHash column, backfill existing rows with SHA-256 of their email
ALTER TABLE `BetaSignup` ADD COLUMN `emailHash` VARCHAR(191) NOT NULL DEFAULT '';

-- Backfill: set emailHash = SHA2(LOWER(TRIM(email)), 256) for existing rows
UPDATE `BetaSignup` SET `emailHash` = SHA2(LOWER(TRIM(`email`)), 256) WHERE `emailHash` = '';

-- Remove the default now that all rows are backfilled
ALTER TABLE `BetaSignup` ALTER COLUMN `emailHash` DROP DEFAULT;

-- Add unique index on emailHash
CREATE UNIQUE INDEX `BetaSignup_emailHash_key` ON `BetaSignup`(`emailHash`);
