import { createClient, createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const FARMER_APP_ID = '6a743cebbaaf44d2a9aea48a';
const FARMER_APP_API_KEY = '44bc036a2ae04df7a44dbf7503e837e3';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const { livestockId } = await req.json();

    if (!user?.id || user.role !== 'admin') {
      return Response.json({ error: 'Administrator access is required' }, { status: 403 });
    }
    if (!livestockId) return Response.json({ error: 'A livestock item is required' }, { status: 400 });

    const farmerApi = createClient({ appId: FARMER_APP_ID, headers: { api_key: FARMER_APP_API_KEY } });
    const livestock = await farmerApi.entities.Livestock.get(livestockId);
    if (!livestock || livestock.disabled) {
      return Response.json({ error: 'This livestock item is no longer available' }, { status: 409 });
    }

    const existingOrders = await base44.asServiceRole.entities.Order.filter({ buyer_id: user.id }, '-created_date', 100);
    const existingOrder = existingOrders.find((order) => order.is_test_order && ['to_ship', 'paid', 'processing', 'to_receive'].includes(order.status) && (order.items || []).some((item) => item.livestock_id === livestockId));
    if (existingOrder) return Response.json({ order: existingOrder });

    const price = Number(livestock.price_per_head || livestock.price || 0);
    const farmerId = livestock.ownerId || livestock.created_by_id || '';
    const order = await base44.asServiceRole.entities.Order.create({
      order_number: `TEST-${Date.now()}`,
      items: [{
        livestock_id: livestock.id,
        farmer_id: farmerId,
        animal: livestock.animal,
        breed: livestock.breed,
        grade: livestock.grade,
        quantity: 1,
        weight_min: livestock.weight_min,
        weight_max: livestock.weight_max,
        price_per_head: price,
        total: price,
      }],
      subtotal: price,
      delivery_fee: 0,
      total: price,
      status: 'to_ship',
      is_test_order: true,
      fulfillment_method: 'delivery',
      buyer_name: user.full_name || user.display_name || user.email,
      buyer_email: user.email,
      buyer_id: user.id,
    });

    return Response.json({ order });
  } catch (error) {
    console.error('createTestOrder error:', error.message);
    return Response.json({ error: 'Unable to create the test order' }, { status: 500 });
  }
});
