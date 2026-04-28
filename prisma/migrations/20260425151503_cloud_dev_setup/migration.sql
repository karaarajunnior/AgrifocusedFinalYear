-- AlterTable
ALTER TABLE `documents` ADD COLUMN `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    ADD COLUMN `verificationLog` LONGTEXT NULL;

-- AlterTable
ALTER TABLE `products` ADD COLUMN `latitude` DOUBLE NULL,
    ADD COLUMN `longitude` DOUBLE NULL,
    ADD COLUMN `origin` ENUM('LOCAL', 'INTERNATIONAL') NOT NULL DEFAULT 'LOCAL';

-- AlterTable
ALTER TABLE `users` ADD COLUMN `latitude` DOUBLE NULL,
    ADD COLUMN `longitude` DOUBLE NULL,
    ADD COLUMN `mfaOtp` VARCHAR(10) NULL,
    ADD COLUMN `mfaOtpExpires` DATETIME(3) NULL,
    MODIFY `role` ENUM('FARMER', 'BUYER', 'ADMIN', 'AGRO_SHOP', 'SUPERMARKET') NOT NULL DEFAULT 'FARMER';

-- CreateTable
CREATE TABLE `verification_rules` (
    `id` VARCHAR(191) NOT NULL,
    `documentType` VARCHAR(64) NOT NULL,
    `criteria` TEXT NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdByUserId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
