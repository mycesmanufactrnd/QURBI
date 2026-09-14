import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { createQurbiUserClient } from '../../shared/qurbiUser.ts';

const ACTIVE_ORDER_STATUSES = new Set([
  'paid', 'to_ship', 'processing', 'shipped', 'to_receive', 'delivering',
]);
const COMPLETED_ORDER_STATUSES = new Set(['completed', 'delivered']);
const REFUND_REQUEST_STATUSES = new Set(['return_requested', 'refund_requested', 'return_refund']);

function itemBelongsToFarmer(item, farmerId, ownedLivestockIds) {
  return item?.farmer_id === farmerId
    || (item?.livestock_id && ownedLivestockIds.has(item.livestock_id));
}

function orderLabel(order) {
  return `#${order.order_number || order.id}`;
}

function notificationsForOrder(order, farmerId, ownedLivestockIds) {
  const status = String(order.status || '').toLowerCase();
  const refundStatus = String(order.refund_status || '').toLowerCase();
  const label = orderLabel(order);
  const livestockId = (order.items || [])
    .find((item) => itemBelongsToFarmer(item, farmerId, ownedLivestockIds))?.livestock_id || '';
  const common = { orderId: order.id, livestockId };

  if (refundStatus === 'rejected') {
    return [{
      ...common,
      type: 'Refund Rejected',
      title: 'Refund request rejected',
      message: `The refund request for order ${label} was rejected. Open the order to review the admin decision.`,
      priority: 'Important',
    }];
  }

  if (status === 'refunded' || ['approved', 'completed'].includes(refundStatus)) {
    return [{
      ...common,
      type: 'Refund Approved',
      title: 'Refund approved',
      message: `The refund for order ${label} was approved. The related livestock is available again.`,
      priority: 'Important',
    }];
  }

  if (REFUND_REQUEST_STATUSES.has(status) || refundStatus === 'pending_admin_approval') {
    return [{
      ...common,
      type: 'Refund Requested',
      title: 'Buyer requested a refund',
      message: `Order ${label} has a return or refund request that requires attention.`,
      priority: 'Important',
    }];
  }

  if (COMPLETED_ORDER_STATUSES.has(status)) {
    return [{
      ...common,
      type: 'Order Completed',
      title: 'Order completed',
      message: `Order ${label} was completed successfully. The livestock is now recorded as sold.`,
      priority: 'Normal',
    }];
  }

  if (ACTIVE_ORDER_STATUSES.has(status)) {
    return [{
      ...common,
      type: 'New Order',
      title: 'New paid order received',
      message: `You received order ${label}. Open it to start the delivery evidence process.`,
      priority: 'Normal',
    }];
  }

  return [];
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const [livestock, orders, existing] = await Promise.all([
      base44.entities.Livestock.filter({ ownerId: user.id }, '-created_date', 500),
      createQurbiUserClient().entities.Order.list('-created_date', 500),
      base44.asServiceRole.entities.FarmerNotification.filter({ farmerId: user.id }, '-created_date', 500),
    ]);

    const ownedLivestockIds = new Set((livestock || []).map((item) => item.id));
    const existingKeys = new Set((existing || []).map((item) => `${item.type}:${item.orderId}`));
    const pending = [];

    for (const order of orders || []) {
      const belongsToFarmer = (order.items || []).some((item) => itemBelongsToFarmer(item, user.id, ownedLivestockIds));
      if (!belongsToFarmer) continue;

      for (const notification of notificationsForOrder(order, user.id, ownedLivestockIds)) {
        const key = `${notification.type}:${notification.orderId}`;
        if (existingKeys.has(key)) continue;
        existingKeys.add(key);
        pending.push(base44.asServiceRole.entities.FarmerNotification.create({
          farmerId: user.id,
          ...notification,
          isRead: false,
        }));
      }
    }

    await Promise.all(pending);
    return Response.json({ created: pending.length });
  } catch (error) {
    console.error('syncFarmerNotifications error:', error.message);
    return Response.json({ error: 'Unable to sync farmer notifications' }, { status: 502 });
  }
});
