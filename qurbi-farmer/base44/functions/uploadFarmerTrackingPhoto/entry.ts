import { createClient, createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const FARMER_STAGES = ['before', 'during', 'after'];
const TRACKABLE_STATUSES = ['paid', 'to_ship', 'processing'];

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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { orderId, stage, imageUrl } = await req.json();
    if (!orderId || !FARMER_STAGES.includes(stage) || typeof imageUrl !== 'string' || !imageUrl.trim()) {
      return Response.json({ error: 'Order, tracking stage and photo are required' }, { status: 400 });
    }

    const qurbi = createClient({
      appId: '6a22824084a6dd7fc49dba93',
      headers: { api_key: '44bc036a2ae04df7a44dbf7503e837e3' },
    });
    const order = await qurbi.entities.Order.get(orderId);
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });
    const livestock = await base44.entities.Livestock.filter({ ownerId: user.id }, '-created_date', 500);
    const livestockById = new Map((livestock || []).map((item) => [item.id, item]));
    const ownedLivestockIds = new Set(livestockById.keys());
    if (!(order.items || []).some((item) => itemBelongsToFarmer(item, user.id, ownedLivestockIds))) {
      return Response.json({ error: 'Only the assigned farmer can update this order' }, { status: 403 });
    }
    if (participantCount(order) > 1) {
      return Response.json({ error: 'This order contains packages from multiple farmers. Tracking must be split before it can be updated safely.' }, { status: 409 });
    }
    if (!TRACKABLE_STATUSES.includes(order.status)) {
      return Response.json({ error: 'This order is not awaiting farmer tracking updates' }, { status: 409 });
    }

    const tracking = order.tracking_photos || {};
    const stageIndex = FARMER_STAGES.indexOf(stage);
    if (stageIndex > 0 && !tracking[FARMER_STAGES[stageIndex - 1]]?.image_url) {
      return Response.json({ error: `Upload the ${FARMER_STAGES[stageIndex - 1]} photo first` }, { status: 409 });
    }
    if (tracking[stage]?.image_url) {
      return Response.json({ error: 'This tracking stage is already complete' }, { status: 409 });
    }

    const nextTracking = {
      ...tracking,
      [stage]: {
        image_url: imageUrl.trim(),
        uploaded_by: user.id,
        uploaded_at: new Date().toISOString(),
      },
    };
    const completed = FARMER_STAGES.every((name) => nextTracking[name]?.image_url);
    const updatedOrder = await qurbi.entities.Order.update(orderId, {
      tracking_photos: nextTracking,
      status: completed ? 'to_receive' : 'processing',
    });

    return Response.json({ order: packageForFarmer(updatedOrder, user.id, livestockById) });
  } catch (error) {
    console.error('uploadFarmerTrackingPhoto error:', error.message);
    return Response.json({ error: 'Unable to save tracking photo' }, { status: 500 });
  }
});
