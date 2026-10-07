-- QURBI buyer behaviour analytics (MySQL 8+ / MariaDB).
-- Run once while DB_SYNC=false. This table stores behaviour events only;
-- farmer-facing responses never expose buyer IDs or personal information.

CREATE TABLE IF NOT EXISTS `buyer_activities` (
  `id` varchar(36) NOT NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `farmerId` varchar(36) NOT NULL,
  `viewerUserId` varchar(36) NULL,
  `eventType` enum('listing_view','add_to_cart','buy_now','farmer_profile_view') NOT NULL,
  `targetType` enum('livestock','bulk_listing','farmer') NOT NULL,
  `targetId` varchar(36) NOT NULL,
  `sessionId` varchar(64) NULL,
  `source` varchar(50) NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_buyer_activities_farmer_date` (`farmerId`, `createdAt`),
  KEY `IDX_buyer_activities_target_date` (`targetType`, `targetId`, `createdAt`),
  KEY `IDX_buyer_activities_viewer` (`viewerUserId`),
  CONSTRAINT `FK_buyer_activities_farmer`
    FOREIGN KEY (`farmerId`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_buyer_activities_viewer`
    FOREIGN KEY (`viewerUserId`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
