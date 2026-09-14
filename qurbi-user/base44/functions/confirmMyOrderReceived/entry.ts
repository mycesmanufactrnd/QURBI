import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    const { orderId } = await req.json();

    if (!user?.id || !orderId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ownedOrders = await base44.asServiceRole.entities.Order.filter(
      { $or: [{ buyer_id: user.id }, { created_by_id: user.id }] },
      '-created_date',
      100,
    );
    const order = ownedOrders.find((candidate) => candidate.id === orderId);

    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });
    if (!['shipped', 'to_receive', 'delivering'].includes(order.status)) {
      return Response.json({ error: 'This order is not awaiting receipt confirmation' }, { status: 409 });
    }
    const tracking = order.tracking_photos || {};
    if (!['before', 'during', 'after'].every((stage) => tracking[stage]?.image_url)) {
      return Response.json({ error: 'The farmer must complete all progress photos before receipt can be confirmed' }, { status: 409 });
    }
    if (!tracking.received?.image_url) {
      return Response.json({ error: 'Upload and save a received-order proof photo before confirming receipt' }, { status: 409 });
    }

    const updatedOrder = await base44.asServiceRole.entities.Order.update(orderId, {
      status: 'completed',
    });
    return Response.json({ order: updatedOrder });
  } catch (error) {
    console.error('confirmMyOrderReceived error:', error.message);
    return Response.json({ error: 'Unable to confirm receipt of this order' }, { status: 500 });
  }
});
