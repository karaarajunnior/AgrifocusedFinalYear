-- CreateTable
CREATE TABLE `input_purchases` (
    `id` VARCHAR(191) NOT NULL,
    `farmerId` VARCHAR(191) NOT NULL,
    `shopId` VARCHAR(191) NOT NULL,
    `agroInputId` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `totalAmount` DOUBLE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `input_purchases_agroInputId_fkey`(`agroInputId`),
    INDEX `input_purchases_farmerId_fkey`(`farmerId`),
    INDEX `input_purchases_shopId_fkey`(`shopId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `input_purchases` ADD CONSTRAINT `input_purchases_agroInputId_fkey` FOREIGN KEY (`agroInputId`) REFERENCES `agro_inputs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `input_purchases` ADD CONSTRAINT `input_purchases_farmerId_fkey` FOREIGN KEY (`farmerId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `input_purchases` ADD CONSTRAINT `input_purchases_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
