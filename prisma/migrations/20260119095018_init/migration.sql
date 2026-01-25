-- AlterTable
ALTER TABLE `messages` ADD COLUMN `audioUrl` TEXT NULL;

-- AlterTable
ALTER TABLE `products` ADD COLUMN `chainBlockNumber` INTEGER NULL,
    ADD COLUMN `chainListedAt` DATETIME(3) NULL,
    ADD COLUMN `chainProductId` INTEGER NULL,
    ADD COLUMN `chainTxHash` VARCHAR(128) NULL,
    ADD COLUMN `country` VARCHAR(64) NULL,
    ADD COLUMN `listedOnChain` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `transactions` ADD COLUMN `currency` VARCHAR(191) NULL DEFAULT 'UGX',
    ADD COLUMN `ledgerEntryId` VARCHAR(64) NULL,
    ADD COLUMN `payerMsisdn` TEXT NULL,
    ADD COLUMN `paymentProofBlockNumber` INTEGER NULL,
    ADD COLUMN `paymentProofDetailsHash` VARCHAR(66) NULL,
    ADD COLUMN `paymentProofOrderHash` VARCHAR(66) NULL,
    ADD COLUMN `paymentProofRecordedAt` DATETIME(3) NULL,
    ADD COLUMN `paymentProofTxHash` VARCHAR(128) NULL,
    ADD COLUMN `provider` VARCHAR(191) NULL,
    ADD COLUMN `providerRaw` LONGTEXT NULL,
    ADD COLUMN `providerReference` TEXT NULL;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `autoFulfillOnPayment` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `country` VARCHAR(64) NULL,
    ADD COLUMN `mfaEnabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `mfaSecret` TEXT NULL,
    ADD COLUMN `mfaTempSecret` TEXT NULL,
    ADD COLUMN `notifyChat` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `notifyOrder` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `notifyPayment` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `notifySms` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `notifyWhatsapp` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `passwordChangedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `walletAddress` VARCHAR(64) NULL;

-- CreateTable
CREATE TABLE `delivery_proofs` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `codeHash` VARCHAR(64) NOT NULL,
    `qrTokenHash` VARCHAR(64) NULL,
    `generatedByUserId` VARCHAR(191) NOT NULL,
    `confirmedByUserId` VARCHAR(191) NULL,
    `generatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `confirmedAt` DATETIME(3) NULL,
    `gpsLocation` VARCHAR(128) NULL,
    `chainTxHash` VARCHAR(128) NULL,
    `chainBlockNumber` INTEGER NULL,

    UNIQUE INDEX `delivery_proofs_orderId_key`(`orderId`),
    INDEX `delivery_proofs_generatedByUserId_generatedAt_idx`(`generatedByUserId`, `generatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cooperative_groups` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `location` VARCHAR(120) NULL,
    `description` TEXT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `cooperative_groups_createdById_createdAt_idx`(`createdById`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cooperative_members` (
    `id` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `role` VARCHAR(16) NOT NULL DEFAULT 'MEMBER',
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `cooperative_members_userId_idx`(`userId`),
    UNIQUE INDEX `cooperative_members_groupId_userId_key`(`groupId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_batches` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `batchCode` VARCHAR(64) NOT NULL,
    `harvestedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `product_batches_productId_createdAt_idx`(`productId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `trace_events` (
    `id` VARCHAR(191) NOT NULL,
    `batchId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(32) NOT NULL,
    `note` TEXT NULL,
    `location` VARCHAR(120) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `trace_events_batchId_createdAt_idx`(`batchId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `climate_alerts` (
    `id` VARCHAR(191) NOT NULL,
    `location` VARCHAR(120) NOT NULL,
    `severity` VARCHAR(16) NOT NULL,
    `title` VARCHAR(120) NOT NULL,
    `body` TEXT NOT NULL,
    `source` VARCHAR(64) NOT NULL,
    `validFrom` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `validTo` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `climate_alerts_location_validTo_idx`(`location`, `validTo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(128) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `replacedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `refresh_tokens_tokenHash_key`(`tokenHash`),
    INDEX `refresh_tokens_userId_idx`(`userId`),
    INDEX `refresh_tokens_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `actorUserId` VARCHAR(191) NULL,
    `action` VARCHAR(64) NOT NULL,
    `targetType` VARCHAR(64) NULL,
    `targetId` VARCHAR(64) NULL,
    `ip` VARCHAR(64) NULL,
    `userAgent` TEXT NULL,
    `metadata` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_actorUserId_createdAt_idx`(`actorUserId`, `createdAt`),
    INDEX `audit_logs_action_createdAt_idx`(`action`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ledger_accounts` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE') NOT NULL,
    `parentId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ledger_accounts_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `journal_entries` (
    `id` VARCHAR(191) NOT NULL,
    `referenceType` VARCHAR(191) NOT NULL,
    `referenceId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NULL,
    `memo` TEXT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'UGX',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `journal_entries_referenceType_referenceId_key`(`referenceType`, `referenceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `journal_lines` (
    `id` VARCHAR(191) NOT NULL,
    `entryId` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `debit` DOUBLE NOT NULL DEFAULT 0,
    `credit` DOUBLE NOT NULL DEFAULT 0,
    `memo` TEXT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `documents` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `originalName` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `storagePath` VARCHAR(191) NOT NULL,
    `extractedText` LONGTEXT NULL,
    `aiSummary` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `device_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `token` VARCHAR(255) NOT NULL,
    `platform` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `device_tokens_token_key`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notification_logs` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `channel` VARCHAR(191) NOT NULL,
    `to` VARCHAR(32) NOT NULL,
    `body` TEXT NULL,
    `provider` VARCHAR(191) NOT NULL DEFAULT 'twilio',
    `providerSid` VARCHAR(64) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'queued',
    `error` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `market_web_prices` (
    `id` VARCHAR(191) NOT NULL,
    `category` ENUM('VEGETABLES', 'FRUITS', 'GRAINS', 'PULSES', 'SPICES', 'DAIRY', 'POULTRY', 'ORGANIC', 'PROCESSED') NULL,
    `commodity` VARCHAR(100) NULL,
    `market` VARCHAR(32) NULL,
    `country` VARCHAR(64) NULL,
    `location` VARCHAR(120) NULL,
    `price` DOUBLE NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'UGX',
    `unit` VARCHAR(32) NULL,
    `source` VARCHAR(64) NOT NULL,
    `sourceUrl` TEXT NULL,
    `collectedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `raw` LONGTEXT NULL,

    INDEX `market_web_prices_category_country_market_collectedAt_idx`(`category`, `country`, `market`, `collectedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `delivery_proofs` ADD CONSTRAINT `delivery_proofs_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `delivery_proofs` ADD CONSTRAINT `delivery_proofs_generatedByUserId_fkey` FOREIGN KEY (`generatedByUserId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `delivery_proofs` ADD CONSTRAINT `delivery_proofs_confirmedByUserId_fkey` FOREIGN KEY (`confirmedByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cooperative_groups` ADD CONSTRAINT `cooperative_groups_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cooperative_members` ADD CONSTRAINT `cooperative_members_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `cooperative_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cooperative_members` ADD CONSTRAINT `cooperative_members_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_batches` ADD CONSTRAINT `product_batches_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trace_events` ADD CONSTRAINT `trace_events_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `product_batches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_replacedById_fkey` FOREIGN KEY (`replacedById`) REFERENCES `refresh_tokens`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ledger_accounts` ADD CONSTRAINT `ledger_accounts_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `ledger_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `journal_lines` ADD CONSTRAINT `journal_lines_entryId_fkey` FOREIGN KEY (`entryId`) REFERENCES `journal_entries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `journal_lines` ADD CONSTRAINT `journal_lines_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `ledger_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messages` ADD CONSTRAINT `messages_receiverId_fkey` FOREIGN KEY (`receiverId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `device_tokens` ADD CONSTRAINT `device_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification_logs` ADD CONSTRAINT `notification_logs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
