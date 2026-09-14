import { createClient, createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const FARMER_APP_ID = '6a743cebbaaf44d2a9aea48a';
const FARMER_APP_API_KEY = '44bc036a2ae04df7a44dbf7503e837e3';
const unavailableStatuses = new Set(['sold', 'unavailable', 'out of stock', 'reserved']);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
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
    if (!['pending', 'to_pay'].includes(order.status)) {
      return Response.json({ error: 'Only unpaid orders can be cancelled' }, { status: 409 });
    }

    const farmerApi = createClient({ appId: FARMER_APP_ID, headers: { api_key: FARMER_APP_API_KEY } });
    let farmerLivestock: any[];
    try { farmerLivestock = await farmerApi.entities.Livestock.list('-created_date', 200); }
    catch (error) { return Response.json({ error: 'Farmer livestock service is temporarily unavailable' }, { status: 502 }); }
    const byId = new Map(farmerLivestock.map((livestock) => [livestock.id, livestock]));
    const records = (order.items || []).map((item) => byId.get(item.livestock_id));
    if (records.some((livestock) => !livestock)) {
      return Response.json({ error: 'This livestock listing could not be verified', code: 'livestock_not_found' }, { status: 409 });
    }
    if (records.some((livestock) => livestock.disabled || unavailableStatuses.has(String(livestock.status || '').trim().toLowerCase()))) {
      const updated = await base44.asServiceRole.entities.Order.update(orderId, { status: 'out_of_stock' });
      return Response.json({ error: 'This livestock is no longer available and has been marked Out of Stock', order: updated }, { status: 409 });
    }

    const updatedOrder = await base44.asServiceRole.entities.Order.update(orderId, { status: 'cancelled' });
    return Response.json({ order: updatedOrder });
  } catch (error) {
    console.error('cancelMyOrder error:', error.message);
    return Response.json({ error: 'Unable to cancel order' }, { status: 500 });
  }
});
