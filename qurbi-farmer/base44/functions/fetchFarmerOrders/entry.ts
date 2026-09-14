import { createClient, createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const FARMER_VISIBLE_STATUSES = new Set([
  'paid', 'to_ship', 'processing', 'shipped', 'to_receive', 'delivering',
  'completed', 'delivered', 'return_requested', 'refund_requested',
  'return_refund', 'refunded',
]);

function isFarmerVisibleOrder(order) {
  return FARMER_VISIBLE_STATUSES.has(String(order?.status || '').toLowerCase());
}

function livestockStatusForOrder(order) {
  const status = String(order?.status || '').toLowerCase();
  const refundStatus = String(order?.refund_status || '').toLowerCase();

  if (refundStatus === 'rejected' && ['return_requested', 'refund_requested'].includes(status)) {
    return 'Sold';
  }
  if (
    ['return_requested', 'refund_requested', 'return_refund', 'refunded'].includes(status)
    || ['approved', 'completed'].includes(refundStatus)
  ) {
    return 'Available';
  }
  if (['completed', 'delivered'].includes(status)) return 'Sold';
  return null;
}

function itemBelongsToFarmer(item, farmerId, ownedLivestockIds) {
  return item?.farmer_id === farmerId
    || (item?.livestock_id && ownedLivestockIds.has(item.livestock_id));
}

function participantCount(order) {
  const farmerIds = new Set(
    (order.items || []).map((item, index) => (
      item.farmer_id || `unverified:${item.livestock_id || index}`
    )),
  );
  return Math.max(farmerIds.size, 1);
}

function packageForFarmer(order, farmerId, livestockById) {
  const ownedLivestockIds = new Set(livestockById.keys());
  const items = (order.items || [])
    .filter((item) => itemBelongsToFarmer(item, farmerId, ownedLivestockIds))
    .map((item) => {
      const livestock = livestockById.get(item.livestock_id);
      return {
        livestock_id: item.livestock_id || '',
        species: item.animal || livestock?.species || 'Livestock',
        breed: item.breed || livestock?.breed || 'Unspecified',
        grade: item.grade || '',
        quantity: Number(item.quantity || 1),
        price_per_head: Number(item.price_per_head || item.total || 0),
        total: Number(item.total || item.price_per_head || 0),
        image_url: livestock?.coverImage || livestock?.images?.[0] || '',
        tag_number: livestock?.tagNumber || livestock?.earTag || '',
      };
    });
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const farmers = participantCount(order);
  const deliveryFee = order.fulfillment_method === 'delivery'
    ? Number(order.delivery_fee || 0) / farmers
    : 0;
  return {
    id: order.id,
    order_number: order.order_number || '',
    created_date: order.created_date || '',
    status: order.status || '',
    payment_status: order.is_test_order ? 'Test order' : 'Paid',
    is_test_order: Boolean(order.is_test_order),
    fulfillment_method: order.fulfillment_method || 'delivery',
    buyer_name: order.buyer_name || 'Buyer',
    buyer_phone: typeof order.buyer_phone === 'string' ? order.buyer_phone.trim() : '',
    items,
    farmer_subtotal: subtotal,
    farmer_delivery_fee: deliveryFee,
    farmer_total: subtotal + deliveryFee,
    tracking_photos: order.tracking_photos || {},
    refund_status: order.refund_status || '',
    refund_reason: order.refund_reason || '',
    refund_admin_note: order.refund_admin_note || '',
    multi_farmer_order: farmers > 1,
    tracking_enabled: farmers === 1,
  };
}

async function reconcileLivestockStatuses(base44, orders, farmerId, livestockById) {
  const ownedLivestockIds = new Set(livestockById.keys());
  const handled = new Set();
  const updates = [];

  // Orders are newest first. Only the newest order for each animal controls its status.
  for (const order of orders) {
    const desiredStatus = livestockStatusForOrder(order);
    for (const item of order.items || []) {
      if (!itemBelongsToFarmer(item, farmerId, ownedLivestockIds)) continue;
      const livestockId = item.livestock_id;
      if (!livestockId || handled.has(livestockId)) continue;
      handled.add(livestockId);

      const livestock = livestockById.get(livestockId);
      if (desiredStatus && livestock && livestock.status !== desiredStatus) {
        updates.push(
          base44.asServiceRole.entities.Livestock.update(livestockId, { status: desiredStatus })
            .then(() => { livestock.status = desiredStatus; }),
        );
      }
    }
  }

  await Promise.all(updates);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { orderId } = await req.json().catch(() => ({}));
    const qurbi = createClient({
      appId: '6a22824084a6dd7fc49dba93',
      headers: { api_key: '44bc036a2ae04df7a44dbf7503e837e3' },
    });
    const livestock = await base44.entities.Livestock.filter({ ownerId: user.id }, '-created_date', 500);
    const livestockById = new Map((livestock || []).map((item) => [item.id, item]));
    const ownedLivestockIds = new Set(livestockById.keys());

    if (orderId) {
      const order = await qurbi.entities.Order.get(orderId);
      const ownsItem = (order?.items || []).some((item) => itemBelongsToFarmer(item, user.id, ownedLivestockIds));
      if (!order || !ownsItem || !isFarmerVisibleOrder(order)) {
        return Response.json({ error: 'Order not found' }, { status: 404 });
      }
      await reconcileLivestockStatuses(base44, [order], user.id, livestockById);
      return Response.json({ order: packageForFarmer(order, user.id, livestockById) });
    }

    const orders = await qurbi.entities.Order.list('-created_date', 500);
    const farmerOrders = (orders || [])
      .filter(isFarmerVisibleOrder)
      .filter((order) => (order.items || []).some((item) => itemBelongsToFarmer(item, user.id, ownedLivestockIds)));
    await reconcileLivestockStatuses(base44, farmerOrders, user.id, livestockById);
    return Response.json({
      orders: farmerOrders.map((order) => packageForFarmer(order, user.id, livestockById)),
    });
  } catch (error) {
    console.error('fetchFarmerOrders error:', error.message);
    return Response.json({ error: 'QURBI User order service is temporarily unavailable' }, { status: 502 });
  }
});
