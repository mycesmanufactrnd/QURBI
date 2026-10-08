-- QURBI CHIP payment-session migration (MySQL 8+).
-- Safe to run repeatedly while DB_SYNC remains false.

CREATE TABLE IF NOT EXISTS `payment_sessions` (
  `id` varchar(36) NOT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `buyerId` varchar(36) NOT NULL,
  `provider` varchar(30) NOT NULL DEFAULT 'chip',
  `providerReference` varchar(255) NULL,
  `status` enum('unpaid','paid','failed','refunded') NOT NULL DEFAULT 'unpaid',
  `providerStatus` varchar(40) NULL,
  `amount` decimal(12,2) NOT NULL,
  `currency` varchar(3) NOT NULL DEFAULT 'MYR',
  `checkoutUrl` text NULL,
  `expiresAt` datetime(6) NULL,
  `paidAt` datetime(6) NULL,
  `failureMessage` text NULL,
  `isTest` tinyint NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_payment_sessions_provider_reference` (`providerReference`),
  KEY `IDX_payment_sessions_buyerId` (`buyerId`),
  KEY `IDX_payment_sessions_status` (`status`),
  CONSTRAINT `FK_payment_sessions_buyer`
    FOREIGN KEY (`buyerId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `payment_session_orders` (
  `id` varchar(36) NOT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `paymentSessionId` varchar(36) NOT NULL,
  `orderId` varchar(36) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_payment_session_order` (`paymentSessionId`, `orderId`),
  KEY `IDX_payment_session_orders_paymentSessionId` (`paymentSessionId`),
  KEY `IDX_payment_session_orders_orderId` (`orderId`),
  CONSTRAINT `FK_payment_session_orders_session`
    FOREIGN KEY (`paymentSessionId`) REFERENCES `payment_sessions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_payment_session_orders_order`
    FOREIGN KEY (`orderId`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
