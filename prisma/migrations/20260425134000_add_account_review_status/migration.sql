ALTER TABLE `users`
  ADD COLUMN `accountStatus` VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN `accountStatusReason` TEXT NULL,
  ADD COLUMN `accountStatusChangedAt` DATETIME(3) NULL;
