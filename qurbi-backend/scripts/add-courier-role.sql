-- QURBI courier role (MySQL 8+ / MariaDB 10.5+).
-- Run once on any database where DB_SYNC is NOT true. With DB_SYNC=true
-- (local dev only) TypeORM creates all of this by itself.
--
-- Couriers sign up, an admin approves them, and they take the pickup /
-- in-transit / delivered proof photos instead of the farmer.

-- 1. The new role is accepted everywhere the other roles are.
ALTER TABLE `users`
  MODIFY COLUMN `role` ENUM('buyer', 'farmer', 'admin', 'courier') NOT NULL;
ALTER TABLE `notifications`
  MODIFY COLUMN `audience` ENUM('buyer', 'farmer', 'admin', 'courier') NOT NULL;
ALTER TABLE `refresh_tokens`
  MODIFY COLUMN `activeRole` ENUM('buyer', 'farmer', 'admin', 'courier') NULL;

-- 2. Orders: when the farmer released the order to the courier pool, and
-- whether the "nobody accepted it" alert has already gone out.
ALTER TABLE `orders`
  ADD COLUMN IF NOT EXISTS `readyForPickupAt` DATETIME(6) NULL,
  ADD COLUMN IF NOT EXISTS `poolAlertedAt` DATETIME(6) NULL;

-- 3. Tracking timeline: live-photo metadata. All NULL for every event that is
-- not courier proof, so existing rows are untouched.
ALTER TABLE `order_tracking_events`
  ADD COLUMN IF NOT EXISTS `stage` ENUM('pickup', 'transit', 'delivery', 'failed') NULL,
  ADD COLUMN IF NOT EXISTS `deliveryAssignmentId` VARCHAR(36) NULL,
  ADD COLUMN IF NOT EXISTS `capturedAt` DATETIME(6) NULL,
  ADD COLUMN IF NOT EXISTS `serverReceivedAt` DATETIME(6) NULL,
  ADD COLUMN IF NOT EXISTS `latitude` DECIMAL(10, 7) NULL,
  ADD COLUMN IF NOT EXISTS `longitude` DECIMAL(10, 7) NULL,
  ADD COLUMN IF NOT EXISTS `accuracyMeters` INT NULL,
  ADD COLUMN IF NOT EXISTS `imageHashes` JSON NULL,
  ADD COLUMN IF NOT EXISTS `flags` JSON NULL,
  ADD COLUMN IF NOT EXISTS `deviceInfo` VARCHAR(255) NULL;

-- 4. Courier accounts.
CREATE TABLE IF NOT EXISTS `courier_profiles` (
  `id` VARCHAR(36) NOT NULL,
  `createdAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `userId` VARCHAR(36) NOT NULL,
  `icNumber` VARCHAR(30) NOT NULL,
  `vehicleType` VARCHAR(40) NOT NULL,
  `vehiclePlate` VARCHAR(20) NOT NULL,
  `serviceAreas` JSON NOT NULL,
  `bankName` VARCHAR(100) NULL,
  `bankAccountNo` VARCHAR(50) NULL,
  `bankAccountHolder` VARCHAR(150) NULL,
  `verificationStatus` ENUM('unverified', 'pending', 'approved', 'rejected', 'suspended') NOT NULL DEFAULT 'unverified',
  `suspensionReason` TEXT NULL,
  `isOnline` TINYINT NOT NULL DEFAULT 0,
  `proposedFee` DECIMAL(10, 2) NULL,
  `approvedFee` DECIMAL(10, 2) NULL,
  `rateStatus` ENUM('pending', 'approved', 'rejected') NULL,
  `rateRejectionReason` TEXT NULL,
  `rateReviewedByUserId` VARCHAR(36) NULL,
  `rateReviewedAt` DATETIME(6) NULL,
  `ratingAverage` DECIMAL(3, 2) NOT NULL DEFAULT 0,
  `ratingCount` INT NOT NULL DEFAULT 0,
  `totalDeliveries` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_courier_profiles_userId` (`userId`),
  CONSTRAINT `FK_courier_profiles_user` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `courier_verifications` (
  `id` VARCHAR(36) NOT NULL,
  `createdAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `courierProfileId` VARCHAR(36) NOT NULL,
  `status` ENUM('unverified', 'pending', 'approved', 'rejected', 'suspended') NOT NULL DEFAULT 'pending',
  `documents` JSON NOT NULL,
  `signatureUrl` VARCHAR(500) NULL,
  `submittedAt` DATETIME(6) NULL,
  `reviewedByUserId` VARCHAR(36) NULL,
  `reviewedAt` DATETIME(6) NULL,
  `rejectionReason` TEXT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_courier_verifications_profile` (`courierProfileId`),
  CONSTRAINT `FK_courier_verifications_profile` FOREIGN KEY (`courierProfileId`) REFERENCES `courier_profiles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_courier_verifications_reviewer` FOREIGN KEY (`reviewedByUserId`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- 5. One row per courier attempt at an order (failed / released attempts stay
-- as history; the app guarantees at most one live row per order).
CREATE TABLE IF NOT EXISTS `delivery_assignments` (
  `id` VARCHAR(36) NOT NULL,
  `createdAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `orderId` VARCHAR(36) NOT NULL,
  `courierProfileId` VARCHAR(36) NOT NULL,
  `courierUserId` VARCHAR(36) NOT NULL,
  `status` ENUM('accepted', 'picked_up', 'in_transit', 'delivered', 'failed', 'cancelled') NOT NULL DEFAULT 'accepted',
  `earningAmount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  `assignedByAdmin` TINYINT NOT NULL DEFAULT 0,
  `acceptedAt` DATETIME(6) NOT NULL,
  `pickedUpAt` DATETIME(6) NULL,
  `inTransitAt` DATETIME(6) NULL,
  `deliveredAt` DATETIME(6) NULL,
  `failedAt` DATETIME(6) NULL,
  `cancelledAt` DATETIME(6) NULL,
  `failureCategory` VARCHAR(40) NULL,
  `failedReason` TEXT NULL,
  `resolutionNote` TEXT NULL,
  `pickupChecklist` JSON NULL,
  `farmerHandoverConfirmedAt` DATETIME(6) NULL,
  `delayAlertedAt` DATETIME(6) NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_delivery_assignments_courierUser` (`courierUserId`),
  KEY `IDX_delivery_assignments_order_status` (`orderId`, `status`),
  KEY `FK_delivery_assignments_profile` (`courierProfileId`),
  CONSTRAINT `FK_delivery_assignments_order` FOREIGN KEY (`orderId`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_delivery_assignments_profile` FOREIGN KEY (`courierProfileId`) REFERENCES `courier_profiles` (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- 6. Append-only record of admin actions on couriers.
CREATE TABLE IF NOT EXISTS `courier_audit_logs` (
  `id` VARCHAR(36) NOT NULL,
  `createdAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `actorUserId` VARCHAR(36) NULL,
  `courierProfileId` VARCHAR(36) NOT NULL,
  `action` VARCHAR(50) NOT NULL,
  `detail` JSON NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_courier_audit_logs_profile` (`courierProfileId`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Keep a partially-created audit table consistent when this script is rerun
-- after an older version failed while adding the foreign-key-backed tables.
ALTER TABLE `courier_audit_logs`
  CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
