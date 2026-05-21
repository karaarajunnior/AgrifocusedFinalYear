-- CreateTable
CREATE TABLE `registration_approval_rules` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(120) NOT NULL DEFAULT 'Default registration rule',
    `requiredFields` JSON NULL,
    `criteria` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdByUserId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `registration_approval_rules_isActive_updatedAt_idx`(`isActive`, `updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
