import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const { orderId, reason, refundEvidence } = await req.json();
    const refundReason = typeof reason === 'string' ? reason.trim() : '';
    const evidence = Array.isArray(refundEvidence)
      ? refundEvidence.map((item) => typeof item === 'string' ? item.trim() : '').filter(Boolean)
      : [];

    if (!user?.id || !orderId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!refundReason) {
      return Response.json({ error: 'Please provide a reason for your refund request' }, { status: 400 });
    }
    if (!evidence.length) {
      return Response.json({ error: 'Upload at least one photo as refund evidence before submitting your request' }, { status: 400 });
    }
    if (evidence.length > 5 || evidence.some((url) => !/^https:\/\//i.test(url))) {
      return Response.json({ error: 'Refund evidence must contain between one and five uploaded photo URLs' }, { status: 400 });
    }

    const ownedOrders = await base44.asServiceRole.entities.Order.filter(
      { $or: [{ buyer_id: user.id }, { created_by_id: user.id }] },
      '-created_date',
      100,
    );
    const order = ownedOrders.find((candidate) => candidate.id === orderId);

    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });
    if (!['shipped', 'to_receive', 'delivering'].includes(order.status)) {
      return Response.json({ error: 'Refunds can only be requested for orders awaiting receipt' }, { status: 409 });
    }

    const updatedOrder = await base44.asServiceRole.entities.Order.update(orderId, {
      status: 'refund_requested',
      refund_reason: refundReason,
      refund_evidence: evidence,
      refund_status: 'pending_admin_approval',
    });
    return Response.json({ order: updatedOrder });
  } catch (error) {
    console.error('requestMyOrderRefund error:', error.message);
    return Response.json({ error: 'Unable to submit the refund request' }, { status: 500 });
  }
});
