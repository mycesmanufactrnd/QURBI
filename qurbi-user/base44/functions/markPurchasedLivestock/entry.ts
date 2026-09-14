import { createClient, createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@14.21.0';

const FARMER_APP_ID = "6a743cebbaaf44d2a9aea48a";
const FARMER_APP_API_KEY = "44bc036a2ae04df7a44dbf7503e837e3";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const { orderId, sessionId } = await req.json();
    if (!user?.id || !orderId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const orders = await base44.asServiceRole.entities.Order.filter(
      { $or: [{ buyer_id: user.id }, { created_by_id: user.id }] },
      '-created_date',
      100,
    );
    let order = orders.find((candidate) => candidate.id === orderId);
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });

    if (order.status !== 'paid') {
      const stripeSessionId = sessionId || order.stripe_session_id;
      if (!stripeSessionId) return Response.json({ error: 'Payment session is required' }, { status: 400 });
      const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
      const session = await stripe.checkout.sessions.retrieve(stripeSessionId);
      if (session.payment_status !== 'paid' || session.metadata?.order_id !== orderId) {
        return Response.json({ error: 'Payment has not been confirmed for this order' }, { status: 409 });
      }
      order = await base44.asServiceRole.entities.Order.update(orderId, {
        status: 'paid',
        stripe_session_id: stripeSessionId,
        payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id || '',
      });
    }

    const farmerApi = createClient({ appId: FARMER_APP_ID, headers: { api_key: FARMER_APP_API_KEY } });
    const livestockIds = [...new Set((order.items || []).map((item) => item.livestock_id).filter(Boolean))];
    const livestock = await farmerApi.entities.Livestock.list('-created_date', 500);
    const livestockById = new Map((livestock || []).map((item) => [item.id, item]));
    const records = livestockIds.map((id) => livestockById.get(id));
    if (records.some((item) => !item)) {
      return Response.json({ error: 'One or more purchased livestock listings could not be verified' }, { status: 409 });
    }

    await Promise.all(records.map((item) => item.disabled
      ? Promise.resolve()
      : farmerApi.entities.Livestock.update(item.id, { disabled: true, status: 'Sold', marketplaceVisible: false })));

    const itemsByFarmer = new Map<string, any[]>();
    for (const orderItem of order.items || []) {
      const listing = livestockById.get(orderItem.livestock_id);
      const farmerId = listing?.ownerId || listing?.created_by_id;
      if (!farmerId) continue;
      itemsByFarmer.set(farmerId, [...(itemsByFarmer.get(farmerId) || []), { orderItem, listing }]);
    }

    let notificationsCreated = 0;
    for (const [farmerId, farmerItems] of itemsByFarmer) {
      const existing = await farmerApi.entities.FarmerNotification.filter({ farmerId, orderId }, '-created_date', 1);
      if (existing?.length) continue;
      const names = farmerItems.map(({ orderItem, listing }) => `${listing.species || orderItem.animal || 'Livestock'}${listing.breed || orderItem.breed ? ` (${listing.breed || orderItem.breed})` : ''}`);
      const total = farmerItems.reduce((sum, { orderItem }) => sum + Number(orderItem.total ?? orderItem.price_per_head ?? 0), 0);
      await farmerApi.entities.FarmerNotification.create({
        farmerId,
        type: 'New Order',
        title: 'New paid order received',
        message: `Order #${order.order_number || order.id} from ${order.buyer_name || 'a buyer'} includes ${names.join(', ')}. Farmer total: RM${total.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
        orderId,
        livestockId: farmerItems.length === 1 ? farmerItems[0].listing.id : '',
        isRead: false,
      });
      notificationsCreated += 1;
    }

    return Response.json({ order, updated: records.length, notificationsCreated });
  } catch (error) {
    console.error('markPurchasedLivestock error:', error.message);
    return Response.json({ error: 'Unable to update livestock availability' }, { status: 500 });
  }
});
