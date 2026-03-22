/*
  Warnings:

  - Made the column `executionMode` on table `Survey` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `Survey` MODIFY `executionMode` VARCHAR(191) NOT NULL DEFAULT 'standard';
