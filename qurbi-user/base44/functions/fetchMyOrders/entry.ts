import { createClient, createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const FARMER_APP_ID = '6a743cebbaaf44d2a9aea48a';
const FARMER_APP_API_KEY = '44bc036a2ae04df7a44dbf7503e837e3';
const unavailableStatuses = new Set(['sold', 'unavailable', 'out of stock', 'reserved']);
const isAvailable = (livestock: any) => Boolean(livestock) && !livestock.disabled && !unavailableStatuses.has(String(livestock.status || '').trim().toLowerCase());

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orderId } = await req.json().catch(() => ({}));
    const ownerQuery = { $or: [{ buyer_id: user.id }, { created_by_id: user.id }] };
    let orders = await base44.asServiceRole.entities.Order.filter(ownerQuery, '-created_date', 100);

    // Pending orders must never remain payable based on a stale product snapshot.
    const farmerApi = createClient({ appId: FARMER_APP_ID, headers: { api_key: FARMER_APP_API_KEY } });
    let farmerLivestock: any[];
    try { farmerLivestock = await farmerApi.entities.Livestock.list('-created_date', 200); }
    catch (error) {
      console.error('Farmer livestock verification failed:', error.message);
      return Response.json({ error: 'Farmer livestock service is temporarily unavailable' }, { status: 502 });
    }
    const farmerLivestockById = new Map(farmerLivestock.map((livestock) => [livestock.id, livestock]));
    const refreshed = await Promise.all(orders.map(async (order) => {
      if (order.hidden_from_history || !['pending', 'to_pay'].includes(order.status)) return order;
      const ids = (order.items || []).map((item) => item.livestock_id).filter(Boolean);
      const records = ids.map((id) => farmerLivestockById.get(id));
      // A missing record is explicitly different from disabled stock. Preserve
      // the order rather than silently classifying an API/data mismatch as stock.
      if (records.some((livestock) => !livestock)) return order;
      if (records.some((livestock) => !isAvailable(livestock))) {
        return base44.asServiceRole.entities.Order.update(order.id, { status: 'out_of_stock' });
      }
      return order;
    }));
    orders = refreshed.filter((order) => !order.hidden_from_history);

    if (orderId) {
      // Filter by owner first, then locate the requested record. This avoids
      // unsupported compound ID queries while never returning another user's order.
      return Response.json({ order: orders.find((order) => order.id === orderId) || null });
    }

    return Response.json({ orders });
  } catch (error) {
    console.error('fetchMyOrders error:', error.message);
    return Response.json({ error: 'Unable to load orders' }, { status: 500 });
  }
});
