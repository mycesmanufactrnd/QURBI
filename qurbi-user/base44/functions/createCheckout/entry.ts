import { createClient, createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@14.21.0';

const FARMER_APP_ID = '6a743cebbaaf44d2a9aea48a';
const FARMER_APP_API_KEY = '44bc036a2ae04df7a44dbf7503e837e3';
const unavailableStatuses = new Set(['sold', 'unavailable', 'out of stock', 'reserved']);
function isLivestockMarketplaceAvailable(livestock: any) {
  return Boolean(livestock) && !livestock.disabled && !unavailableStatuses.has(String(livestock.status || '').trim().toLowerCase());
}
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"));
    const user = await base44.auth.me();
    const { orderId } = await req.json();
    if (!user?.id || !orderId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const ownedOrders = await base44.asServiceRole.entities.Order.filter(
      { $or: [{ buyer_id: user.id }, { created_by_id: user.id }] },
      '-created_date',
      100,
    );
    const order = ownedOrders.find((candidate) => candidate.id === orderId);
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });
    if (!['pending', 'to_pay'].includes(order.status)) return Response.json({ error: 'This order is no longer awaiting payment' }, { status: 409 });
    const { order_number: orderNumber, items, buyer_email: buyerEmail, buyer_name: buyerName, delivery_fee: deliveryFee } = order;

    if (!Array.isArray(items) || items.some((item) => item.quantity !== 1)) {
      return Response.json({ error: 'Each livestock listing can only be purchased once' }, { status: 400 });
    }
    const farmerApi = createClient({ appId: FARMER_APP_ID, headers: { api_key: FARMER_APP_API_KEY } });
    const livestockItems = items.filter((item) => item.item_type !== 'bulk');
    const bulkItems = items.filter((item) => item.item_type === 'bulk');
    let farmerLivestock: any[];
    let farmerBulkListings: any[];
    try {
      [farmerLivestock, farmerBulkListings] = await Promise.all([
        livestockItems.length ? farmerApi.entities.Livestock.list('-created_date', 200) : Promise.resolve([]),
        bulkItems.length ? farmerApi.entities.BulkListing.list('-created_date', 200) : Promise.resolve([]),
      ]);
    } catch (error) { return Response.json({ error: 'Farmer marketplace service is temporarily unavailable' }, { status: 502 }); }
    const livestockById = new Map(farmerLivestock.map((livestock) => [livestock.id, livestock]));
    const bulkById = new Map(farmerBulkListings.map((listing) => [listing.id, listing]));
    const records = livestockItems.map((item) => livestockById.get(item.livestock_id));
    if (records.some((livestock) => !livestock)) {
      return Response.json({ error: 'One or more livestock listings could not be verified', code: 'livestock_not_found' }, { status: 409 });
    }
    if (records.some((livestock) => !isLivestockMarketplaceAvailable(livestock))) {
      const updated = await base44.asServiceRole.entities.Order.update(orderId, { status: 'out_of_stock' });
      return Response.json({ error: 'This livestock is no longer available', order: updated }, { status: 409 });
    }
    const bulkRecords = bulkItems.map((item) => bulkById.get(item.bulk_listing_id));
    if (bulkRecords.some((listing) => !listing)) {
      return Response.json({ error: 'One or more bulk listings could not be verified', code: 'bulk_listing_not_found' }, { status: 409 });
    }
    if (bulkRecords.some((listing) => listing.status !== 'Available' || listing.marketplaceVisible !== true)) {
      return Response.json({ error: 'This bulk lot is no longer available', code: 'bulk_listing_unavailable' }, { status: 409 });
    }
    const verifiedItems = items.map((item) => {
      if (item.item_type !== 'bulk') return item;
      const listing = bulkById.get(item.bulk_listing_id);
      const maleCount = Number(listing.maleCount || 0);
      const femaleCount = Number(listing.femaleCount || 0);
      const totalPrice = Number(listing.totalPrice || 0);
      return {
        ...item, item_type: 'bulk', farmer_id: listing.ownerId || '', listing_name: listing.name || item.listing_name,
        male_count: maleCount, female_count: femaleCount, total_animals: maleCount + femaleCount,
        breed_breakdown: listing.breedBreakdown || [], state: listing.state || '', quantity: 1,
        price_per_head: totalPrice, total: totalPrice,
      };
    });
    if (bulkItems.length && verifiedItems.some((item, index) => item.item_type === 'bulk' && (item.price_per_head !== items[index].price_per_head || item.total !== items[index].total))) {
      return Response.json({ error: 'A bulk lot price changed. Please review the updated lot before payment.', code: 'bulk_listing_price_changed' }, { status: 409 });
    }
    if (bulkItems.length) await base44.asServiceRole.entities.Order.update(orderId, { items: verifiedItems });

    const origin = req.headers.get("origin") || "https://app.base44.com";

    const lineItems = verifiedItems.map((item) => ({
      price_data: {
        currency: "myr",
        product_data: {
          name: item.item_type === 'bulk' ? `${item.listing_name} — Bulk lot` : `${item.animal} — ${item.breed} (Grade ${item.grade})`,
          description: item.item_type === 'bulk'
            ? `${item.total_animals || 0} animals (${item.male_count || 0} male, ${item.female_count || 0} female) | Complete lot`
            : `Weight: ${item.weight_min}–${item.weight_max} kg/head | ${item.quantity} head`,
        },
        unit_amount: Math.round(item.price_per_head * 100),
      },
      quantity: item.quantity,
    }));

    // Add delivery fee as a separate line item (grouped per farmer)
    if (deliveryFee && deliveryFee > 0) {
      lineItems.push({
        price_data: {
          currency: "myr",
          product_data: {
            name: "Delivery Fee",
            description: "Per-farmer flat delivery rate",
          },
          unit_amount: Math.round(deliveryFee * 100),
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: buyerEmail,
      line_items: lineItems,
      success_url: `${origin}/receipt?session_id={CHECKOUT_SESSION_ID}&order_id=${orderId}`,
      cancel_url: `${origin}/cart`,
      metadata: {
        base44_app_id: Deno.env.get("BASE44_APP_ID"),
        order_id: orderId,
        order_number: orderNumber,
        buyer_name: buyerName,
      },
    });

    await base44.asServiceRole.entities.Order.update(orderId, { stripe_session_id: session.id });

    console.log("Stripe session created:", session.id, "for order:", orderId);
    return Response.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error("Checkout error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
