const FARMER_VISIBLE_STATUSES = new Set([
  'paid',
  'to_ship',
  'processing',
  'shipped',
  'to_receive',
  'delivering',
  'completed',
  'delivered',
  'return_requested',
  'refund_requested',
  'return_refund',
  'refunded',
]);

export function isFarmerVisibleOrder(order) {
  return FARMER_VISIBLE_STATUSES.has(String(order?.status || '').toLowerCase());
}

export function itemBelongsToFarmer(item, farmerId, ownedLivestockIds) {
  return item?.farmer_id === farmerId
    || (item?.livestock_id && ownedLivestockIds.has(item.livestock_id));
}

export function participantCount(order) {
  const farmerIds = new Set(
    (order.items || []).map((item, index) => (
      item.farmer_id || `unverified:${item.livestock_id || index}`
    )),
  );
  return Math.max(farmerIds.size, 1);
}

function safeBuyerPhone(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function packageForFarmer(order, farmerId, livestockById) {
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
    buyer_phone: safeBuyerPhone(order.buyer_phone),
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
