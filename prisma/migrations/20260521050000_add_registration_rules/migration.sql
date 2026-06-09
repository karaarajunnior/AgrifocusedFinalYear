-- CreateTable
CREATE TABLE `registration_rules` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `ruleType` VARCHAR(48) NOT NULL,
    `appliesToRole` VARCHAR(32) NULL,
    `config` TEXT NOT NULL,
    `action` VARCHAR(16) NOT NULL DEFAULT 'APPROVE',
    `reason` TEXT NULL,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdByUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `registration_rules_isActive_priority_idx`(`isActive`, `priority`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `registration_decisions` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(64) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `role` VARCHAR(32) NOT NULL,
    `decision` VARCHAR(16) NOT NULL,
    `matchedRuleId` VARCHAR(64) NULL,
    `reason` TEXT NULL,
    `payloadSnap` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `registration_decisions_userId_idx`(`userId`),
    INDEX `registration_decisions_decision_createdAt_idx`(`decision`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
