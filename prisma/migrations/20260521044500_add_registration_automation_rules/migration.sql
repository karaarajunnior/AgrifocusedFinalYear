-- CreateTable
CREATE TABLE `registration_automation_rules` (
    `id` VARCHAR(191) NOT NULL,
    `targetRole` ENUM('FARMER', 'BUYER', 'ADMIN', 'AGRO_SHOP', 'SUPERMARKET') NOT NULL,
    `requiredFields` JSON NULL,
    `criteria` TEXT NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdByUserId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `registration_automation_rules_targetRole_key`(`targetRole`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
