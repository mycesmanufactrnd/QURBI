import { createClient, createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id || user.role !== 'admin') {
      return Response.json({ error: 'Administrator access is required' }, { status: 403 });
    }

    const qurbiUser = createClient({
      appId: '6a22824084a6dd7fc49dba93',
      headers: { api_key: '44bc036a2ae04df7a44dbf7503e837e3' },
    });
    const orders = await qurbiUser.entities.Order.list('-created_date', 500);
    return Response.json({ orders: orders || [] });
  } catch (error) {
    console.error('fetchAdminBuyerOrders error:', error.message);
    return Response.json({ error: 'Unable to load QURBI User orders' }, { status: 502 });
  }
});
