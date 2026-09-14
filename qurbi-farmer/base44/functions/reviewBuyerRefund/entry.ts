import { createClient, createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id || user.role !== 'admin') {
      return Response.json({ error: 'Administrator access is required' }, { status: 403 });
    }

    const { orderId, decision, reason } = await req.json().catch(() => ({}));
    const reviewReason = typeof reason === 'string' ? reason.trim() : '';
    if (!orderId || !['approve', 'reject'].includes(decision) || !reviewReason) {
      return Response.json({ error: 'Order, decision and review reason are required' }, { status: 400 });
    }

    const qurbiUser = createClient({
      appId: '6a22824084a6dd7fc49dba93',
      headers: { api_key: '44bc036a2ae04df7a44dbf7503e837e3' },
    });
    const order = await qurbiUser.entities.Order.get(orderId);
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });
    if (order.status !== 'refund_requested' || order.refund_status !== 'pending_admin_approval') {
      return Response.json({ error: 'This refund request has already been reviewed' }, { status: 409 });
    }

    const reviewAudit = {
      refund_admin_note: reviewReason,
      refund_reviewed_by: user.email || user.id,
      refund_reviewed_at: new Date().toISOString(),
    };
    const update = decision === 'approve'
      ? { ...reviewAudit, status: 'refunded', refund_status: 'completed' }
      : { ...reviewAudit, refund_status: 'rejected' };
    const updatedOrder = await qurbiUser.entities.Order.update(orderId, update);

    const livestockStatus = decision === 'approve' ? 'Available' : 'Sold';
    const livestockIds = [...new Set(
      (order.items || []).map((item) => item.livestock_id).filter(Boolean),
    )];
    const statusUpdates = await Promise.allSettled(
      livestockIds.map((livestockId) => (
        base44.asServiceRole.entities.Livestock.update(livestockId, { status: livestockStatus })
      )),
    );
    statusUpdates.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Livestock ${livestockIds[index]} status sync failed:`, result.reason?.message || result.reason);
      }
    });

    return Response.json({ order: updatedOrder });
  } catch (error) {
    console.error('reviewBuyerRefund error:', error.message);
    return Response.json({ error: 'Unable to review the refund request' }, { status: 500 });
  }
});
