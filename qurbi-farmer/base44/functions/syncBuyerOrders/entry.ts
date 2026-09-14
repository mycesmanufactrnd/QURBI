import { createClient, createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // This farmer's livestock IDs — only orders for these should sync.
    const myLivestock = await base44.entities.Livestock.filter({ ownerId: user.id }, '-created_date', 500);
    const livestockIds = new Set((myLivestock || []).map((l) => l.id));
    if (livestockIds.size === 0) return Response.json({ synced: 0, total: 0 });

    // Read orders from the QURBI User app.
    const qurbi = createClient({
      appId: '6a22824084a6dd7fc49dba93',
      headers: { api_key: '44bc036a2ae04df7a44dbf7503e837e3' },
    });
    const remoteOrders = await qurbi.entities.Order.list('-created_date', 200);
    const mine = (remoteOrders || []).filter((o) => o.livestockId && livestockIds.has(o.livestockId));
    if (mine.length === 0) return Response.json({ synced: 0, total: 0 });

    // Idempotency: skip orderNumbers already stored locally for this farmer.
    const localOrders = await base44.asServiceRole.entities.Order.filter({ sellerId: user.id }, '-created_date', 500);
    const seen = new Set((localOrders || []).map((o) => o.orderNumber).filter(Boolean));

    let created = 0;
    for (const o of mine) {
      const key = o.orderNumber || o.id;
      if (!key || seen.has(key)) continue;
      await base44.asServiceRole.entities.Order.create({
        orderNumber: o.orderNumber || key,
        livestockId: o.livestockId,
        livestockName: o.livestockName || "Livestock",
        buyerName: o.buyerName || "Buyer",
        buyerId: o.buyerId || "",
        sellerId: user.id,
        status: o.status || "Pending",
        purchasePrice: o.purchasePrice ?? 0,
        purchaseDate: o.purchaseDate || "",
      });
      seen.add(key);
      created++;
    }
    return Response.json({ synced: created, total: mine.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
