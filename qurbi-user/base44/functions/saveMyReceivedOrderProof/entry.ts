import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    const { orderId, receivedPhotoUrl } = await req.json().catch(() => ({}));
    if (!user?.id || !orderId) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (typeof receivedPhotoUrl !== 'string' || !receivedPhotoUrl.trim()) {
      return Response.json({ error: 'A received-order proof photo is required' }, { status: 400 });
    }

    const ownOrders = await base44.asServiceRole.entities.Order.filter(
      { $or: [{ buyer_id: user.id }, { created_by_id: user.id }] }, '-created_date', 100,
    );
    const order = ownOrders.find((candidate) => candidate.id === orderId);
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });
    if (!['shipped', 'to_receive', 'delivering'].includes(order.status)) {
      return Response.json({ error: 'This order is not awaiting receipt confirmation' }, { status: 409 });
    }

    const tracking = order.tracking_photos || {};
    if (!['before', 'during', 'after'].every((stage) => tracking[stage]?.image_url)) {
      return Response.json({ error: 'The farmer must complete all progress photos before received proof can be saved' }, { status: 409 });
    }
    const updatedOrder = await base44.asServiceRole.entities.Order.update(orderId, {
      tracking_photos: {
        ...tracking,
        received: { image_url: receivedPhotoUrl.trim(), uploaded_by: user.id, uploaded_at: new Date().toISOString() },
      },
    });
    return Response.json({ order: updatedOrder });
  } catch (error) {
    console.error('saveMyReceivedOrderProof error:', error.message);
    return Response.json({ error: 'Unable to save received-order proof' }, { status: 500 });
  }
});
