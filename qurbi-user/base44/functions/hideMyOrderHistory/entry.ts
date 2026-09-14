import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const { orderIds } = await req.json().catch(() => ({}));
    const ids = [...new Set((Array.isArray(orderIds) ? orderIds : []).filter(Boolean))];
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!ids.length) return Response.json({ error: 'Select at least one order' }, { status: 400 });
    const ownOrders = await base44.asServiceRole.entities.Order.filter({ $or: [{ buyer_id: user.id }, { created_by_id: user.id }] }, '-created_date', 100);
    const selected = ownOrders.filter((order) => ids.includes(order.id));
    if (selected.length !== ids.length || selected.some((order) => !['cancelled', 'out_of_stock'].includes(order.status))) {
      return Response.json({ error: 'Only your cancelled or out-of-stock orders can be removed from history' }, { status: 403 });
    }
    await Promise.all(selected.map((order) => base44.asServiceRole.entities.Order.update(order.id, { hidden_from_history: true })));
    return Response.json({ orderIds: ids });
  } catch (error) {
    console.error('hideMyOrderHistory error:', error.message);
    return Response.json({ error: 'Unable to remove order history' }, { status: 500 });
  }
});
