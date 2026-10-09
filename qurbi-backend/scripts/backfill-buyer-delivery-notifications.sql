-- Restore buyer notifications for farmer proof photos uploaded before the
-- delivery-notification hook was added. Safe to run repeatedly.

INSERT INTO `notifications` (
  `id`, `createdAt`, `updatedAt`, `userId`, `audience`, `type`, `title`,
  `body`, `linkUrl`, `relatedType`, `relatedId`, `isRead`, `readAt`, `isCleared`
)
SELECT
  UUID(),
  event.`createdAt`,
  CURRENT_TIMESTAMP(6),
  orders.`buyerId`,
  'buyer',
  'delivery',
  CASE event.`status`
    WHEN 'preparing' THEN 'Farmer uploaded a preparation photo'
    WHEN 'in_transit' THEN 'Your order is on the way'
    ELSE 'Your order has arrived'
  END,
  CASE event.`status`
    WHEN 'preparing' THEN 'A new before-delivery proof photo is ready to view in your order.'
    WHEN 'in_transit' THEN 'The farmer uploaded a delivery progress photo for your order.'
    ELSE 'The farmer uploaded the arrival proof photo. Open your order to review it.'
  END,
  CONCAT('/orders/', orders.`id`),
  'order',
  orders.`id`,
  0,
  NULL,
  0
FROM `order_tracking_events` event
INNER JOIN `orders` orders ON orders.`id` = event.`orderId`
WHERE event.`status` IN ('preparing', 'in_transit', 'delivered')
  AND event.`images` IS NOT NULL
  AND JSON_LENGTH(event.`images`) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM `notifications` existing
    WHERE existing.`userId` = orders.`buyerId`
      AND existing.`audience` = 'buyer'
      AND existing.`type` = 'delivery'
      AND existing.`relatedId` = orders.`id`
      AND existing.`title` = CASE event.`status`
        WHEN 'preparing' THEN 'Farmer uploaded a preparation photo'
        WHEN 'in_transit' THEN 'Your order is on the way'
        ELSE 'Your order has arrived'
      END
  );
