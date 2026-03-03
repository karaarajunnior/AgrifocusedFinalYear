-- AlterTable
ALTER TABLE `market_web_prices` MODIFY `category` ENUM('COFFEE', 'VEGETABLES', 'FRUITS', 'GRAINS', 'PULSES', 'SPICES', 'DAIRY', 'POULTRY', 'ORGANIC', 'PROCESSED') NULL;

-- AlterTable
ALTER TABLE `notification_logs` MODIFY `to` VARCHAR(255) NOT NULL,
    MODIFY `provider` VARCHAR(191) NOT NULL DEFAULT 'internal';

-- AlterTable
ALTER TABLE `products` MODIFY `category` ENUM('COFFEE', 'VEGETABLES', 'FRUITS', 'GRAINS', 'PULSES', 'SPICES', 'DAIRY', 'POULTRY', 'ORGANIC', 'PROCESSED') NOT NULL;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `isExportVerified` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `role` ENUM('FARMER', 'BUYER', 'ADMIN', 'AGRO_SHOP') NOT NULL DEFAULT 'FARMER';

-- CreateTable
CREATE TABLE `collection_schedules` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `subcounty` VARCHAR(120) NOT NULL,
    `district` VARCHAR(120) NOT NULL DEFAULT 'Jinja',
    `collectionDate` DATETIME(3) NOT NULL,
    `vehicleType` VARCHAR(32) NOT NULL DEFAULT 'truck',
    `maxCapacityKg` INTEGER NOT NULL DEFAULT 5000,
    `currentBookedKg` INTEGER NOT NULL DEFAULT 0,
    `pricePerKg` DOUBLE NULL,
    `notes` TEXT NULL,
    `status` ENUM('OPEN', 'FULL', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
    `postedById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `collection_schedules_subcounty_collectionDate_idx`(`subcounty`, `collectionDate`),
    INDEX `collection_schedules_status_collectionDate_idx`(`status`, `collectionDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `collection_requests` (
    `id` VARCHAR(191) NOT NULL,
    `scheduleId` VARCHAR(191) NOT NULL,
    `farmerId` VARCHAR(191) NOT NULL,
    `quantityKg` INTEGER NOT NULL,
    `productId` VARCHAR(191) NULL,
    `pickupLocation` VARCHAR(200) NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'COLLECTED') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `collection_requests_scheduleId_farmerId_key`(`scheduleId`, `farmerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `export_applications` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `businessName` VARCHAR(191) NOT NULL,
    `tinNumber` VARCHAR(191) NOT NULL,
    `permitNumber` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `documents` JSON NULL,
    `rejectionReason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `market_prices` (
    `id` VARCHAR(191) NOT NULL,
    `commodity` VARCHAR(191) NOT NULL,
    `region` VARCHAR(191) NOT NULL,
    `marketType` ENUM('LOCAL', 'REGIONAL', 'EXPORT') NOT NULL DEFAULT 'LOCAL',
    `pricePerKg` DOUBLE NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'UGX',
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `agro_inputs` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `price` DOUBLE NOT NULL,
    `unit` VARCHAR(191) NOT NULL DEFAULT 'item',
    `category` VARCHAR(191) NOT NULL,
    `inStock` BOOLEAN NOT NULL DEFAULT true,
    `shopId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `input_credits` (
    `id` VARCHAR(191) NOT NULL,
    `farmerId` VARCHAR(191) NOT NULL,
    `shopId` VARCHAR(191) NOT NULL,
    `agroInputId` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `totalAmount` DOUBLE NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'ACTIVE', 'SETTLED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `repaymentStatus` BOOLEAN NOT NULL DEFAULT false,
    `deductionPercent` DOUBLE NOT NULL DEFAULT 100,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `traceability_records` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `batchNumber` VARCHAR(191) NOT NULL,
    `altitude` INTEGER NULL,
    `variety` VARCHAR(191) NULL,
    `processingMethod` VARCHAR(191) NULL,
    `roastProfile` VARCHAR(191) NULL,
    `cuppingScore` DOUBLE NULL,
    `farmerId` VARCHAR(191) NOT NULL,
    `story` LONGTEXT NULL,
    `mapLocation` VARCHAR(191) NULL,
    `qrCodeUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `traceability_records_productId_key`(`productId`),
    UNIQUE INDEX `traceability_records_batchNumber_key`(`batchNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `forward_contracts` (
    `id` VARCHAR(191) NOT NULL,
    `farmerId` VARCHAR(191) NOT NULL,
    `buyerId` VARCHAR(191) NOT NULL,
    `commodity` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `pricePerUnit` DOUBLE NOT NULL,
    `totalValuation` DOUBLE NOT NULL,
    `deliveryMonth` VARCHAR(191) NOT NULL,
    `status` ENUM('PROPOSED', 'ACTIVE', 'FULFILLED', 'CANCELLED') NOT NULL DEFAULT 'PROPOSED',
    `terms` TEXT NULL,
    `escrowDeposit` DOUBLE NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `grading_requests` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `commodity` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `grade` VARCHAR(191) NULL,
    `aromaScore` DOUBLE NULL,
    `flavorScore` DOUBLE NULL,
    `bodyScore` DOUBLE NULL,
    `notes` TEXT NULL,
    `certificateUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `collection_schedules` ADD CONSTRAINT `collection_schedules_postedById_fkey` FOREIGN KEY (`postedById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `collection_requests` ADD CONSTRAINT `collection_requests_scheduleId_fkey` FOREIGN KEY (`scheduleId`) REFERENCES `collection_schedules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `collection_requests` ADD CONSTRAINT `collection_requests_farmerId_fkey` FOREIGN KEY (`farmerId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `export_applications` ADD CONSTRAINT `export_applications_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agro_inputs` ADD CONSTRAINT `agro_inputs_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `input_credits` ADD CONSTRAINT `input_credits_farmerId_fkey` FOREIGN KEY (`farmerId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `input_credits` ADD CONSTRAINT `input_credits_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `input_credits` ADD CONSTRAINT `input_credits_agroInputId_fkey` FOREIGN KEY (`agroInputId`) REFERENCES `agro_inputs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `traceability_records` ADD CONSTRAINT `traceability_records_farmerId_fkey` FOREIGN KEY (`farmerId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `forward_contracts` ADD CONSTRAINT `forward_contracts_farmerId_fkey` FOREIGN KEY (`farmerId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `forward_contracts` ADD CONSTRAINT `forward_contracts_buyerId_fkey` FOREIGN KEY (`buyerId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grading_requests` ADD CONSTRAINT `grading_requests_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
